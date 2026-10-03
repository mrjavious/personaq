import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import storage from '@/lib/storage';
import { processMediaImage } from '@/lib/media/processor';
import { getActivePersona } from '@/lib/persona/service';
import { runSafetyGatePipeline } from '@/lib/safety/pipeline';
import { withApi } from '@/lib/api/handler';

export const POST = withApi(
  async (request: Request) => {
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
      return NextResponse.json(
        { error: 'No active persona found. Please specify personaId.', success: false },
        { status: 404 },
      );
    }

    if (!file) {
      return NextResponse.json({ error: 'No reference image file provided', success: false }, { status: 400 });
    }

    // Validate mime type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Only image files are allowed as visual references', success: false },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Process image: create thumbnail, extract metadata
    const media = await processMediaImage(buffer, persona.id);

    // Run safety gate checks (SFW + adult >= 21)
    const safety = await runSafetyGatePipeline({
      buffer: media.optimizedBuffer,
      metadata: {
        prompt: 'Persona visual reference image',
        tags: ['reference_image', persona.name],
        suitability: 'sfw_safe',
      },
    });

    if (safety.status === 'blocked') {
      return NextResponse.json(
        {
          error: 'Safety violation: Uploaded reference does not meet compliance standards (adult fictional persona only)',
          details: safety.reasons,
          success: false,
        },
        { status: 422 },
      );
    }

    // Save to storage
    const timestamp = Date.now();
    const cleanFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const mainKey = `${persona.id}/references/${timestamp}_${cleanFilename}`;
    const uploadResult = await storage.upload(media.optimizedBuffer, mainKey, file.type || 'image/jpeg');

    // Create asset record
    const asset = await prisma.asset.create({
      data: {
        personaId: persona.id,
        storageKey: uploadResult.storageKey,
        url: uploadResult.url,
        type: 'image',
        suitability: 'sfw_safe',
        aiGenerated: false,
        provenanceMeta: JSON.stringify({
          source: 'user_uploaded_reference',
          originalName: file.name,
          safetyStatus: safety.status,
          uploadedAt: new Date().toISOString(),
        }),
        safetyStatus: safety.status,
        safetyReasons: JSON.stringify(safety.reasons),
        tags: JSON.stringify(['reference_image']),
      },
    });

    return NextResponse.json({
      success: true,
      url: uploadResult.url,
      asset,
      safetyStatus: safety.status,
    });
  },
  { permission: 'manage_persona' },
);
