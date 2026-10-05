import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import storage from '@/lib/storage';
import { processMediaImage } from '@/lib/media/processor';
import { runSafetyGatePipeline } from '@/lib/safety/pipeline';
import { withApi } from '@/lib/api/handler';

export const POST = withApi(
  async (request: Request) => {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const personaId = formData.get('personaId') as string | null;

    if (!personaId) {
      return NextResponse.json({ error: 'personaId is required', success: false }, { status: 400 });
    }

    const persona = await prisma.persona.findUnique({ where: { id: personaId } });
    if (!persona) {
      return NextResponse.json({ error: 'Persona not found', success: false }, { status: 404 });
    }

    if (!file) {
      return NextResponse.json({ error: 'No image file provided', success: false }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Only image files are allowed for face cards', success: false },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Process image: optimize and extract dimensions
    const media = await processMediaImage(buffer, persona.id);

    // Run Section 2 Safety Gate pipeline (SFW + adult)
    const safety = await runSafetyGatePipeline({
      buffer: media.optimizedBuffer,
      metadata: {
        prompt: `User uploaded face card candidate sheet for ${persona.name}`,
        tags: ['face_candidate', persona.name],
        suitability: 'sfw_safe',
        adultAge: persona.adultAge,
      },
    });

    if (safety.status === 'blocked') {
      return NextResponse.json(
        {
          error: 'Safety violation: Uploaded face card does not meet compliance standards (adult fictional persona only)',
          details: safety.reasons,
          success: false,
        },
        { status: 422 }
      );
    }

    // Save to storage under persona face-card path
    const timestamp = Date.now();
    const cleanFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storageKey = `${persona.id}/face-card/${timestamp}_${cleanFilename}`;
    const uploadResult = await storage.upload(media.optimizedBuffer, storageKey, file.type || 'image/jpeg');

    // Create asset record with kind: 'face_candidate' and safetyStatus: 'passed'
    const candidateAsset = await prisma.asset.create({
      data: {
        personaId: persona.id,
        storageKey: uploadResult.storageKey,
        url: uploadResult.url,
        type: 'image',
        kind: 'face_candidate',
        suitability: 'sfw_safe',
        safetyStatus: 'passed',
        aiGenerated: false,
        provenanceMeta: JSON.stringify({
          source: 'user_uploaded_candidate',
          originalName: file.name,
          safetyStatus: 'passed',
          uploadedAt: new Date().toISOString(),
          width: media.width,
          height: media.height,
        }),
        tags: JSON.stringify(['face_candidate', 'character_sheet']),
      },
    });

    // Update persona faceStatus to draft if none
    if (persona.faceStatus === 'none') {
      await prisma.persona.update({
        where: { id: persona.id },
        data: { faceStatus: 'draft' },
      });
    }

    return NextResponse.json({
      success: true,
      asset: candidateAsset,
      url: uploadResult.url,
    });
  },
  { permission: 'manage_persona' }
);
