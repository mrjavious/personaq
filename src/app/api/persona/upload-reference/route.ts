import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { storage } from '@/lib/storage';
import { processMediaImage } from '@/lib/media/processor';
import { getActivePersona } from '@/lib/persona/service';
import { runSafetyGatePipeline } from '@/lib/safety/pipeline';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const personaId = formData.get('personaId') as string | null;

    let persona = null;
    if (personaId) {
      persona = await prisma.persona.findUnique({ where: { id: personaId } });
    }
    if (!persona) {
      persona = await getActivePersona();
    }

    if (!persona) {
      return NextResponse.json({ error: 'No active persona found. Please specify personaId.' }, { status: 404 });
    }

    if (!file) {
      return NextResponse.json({ error: 'No reference image file provided' }, { status: 400 });
    }

    // Validate mime type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image files are allowed as visual references' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Run safety gate checks (SFW + adult >= 21)
    const safety = await runSafetyGatePipeline({
      buffer,
      metadata: {
        prompt: 'Persona visual reference image',
        tags: ['reference_image', persona.name],
        suitability: 'sfw_safe',
      },
    });

    if (safety.status === 'blocked') {
      return NextResponse.json(
        {
          error: `Safety guardrail violation: ${safety.reasons.join(', ')}`,
        },
        { status: 422 }
      );
    }

    // Process image: strip EXIF, standardize to JPEG
    const processed = await processMediaImage(buffer, persona.id);

    const timestamp = Date.now();
    const storageKey = `personas/${persona.id}/reference_${timestamp}.jpg`;

    const uploaded = await storage.upload(
      processed.optimizedBuffer,
      storageKey,
      'image/jpeg'
    );

    return NextResponse.json({
      success: true,
      imageUrl: uploaded.url,
      sha256: processed.contentHashSha256,
      message: 'Reference image uploaded and verified successfully',
    });
  } catch (error) {
    console.error('Reference upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload reference image' },
      { status: 500 }
    );
  }
}
