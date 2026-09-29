import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import storage from '@/lib/storage';
import { processMediaImage } from '@/lib/media/processor';
import { runSafetyGatePipeline } from '@/lib/safety/pipeline';
import { getCurrentUser } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    const formData = await request.formData();

    const file = formData.get('file') as File | null;
    const personaId = (formData.get('personaId') as string) || '';
    const suitability = (formData.get('suitability') as string) || 'sfw_safe';
    const tagsString = (formData.get('tags') as string) || '[]';
    const prompt = (formData.get('prompt') as string) || '';

    // Simulated custom classifier scores (if provided by UI or test suite)
    const customScoresJson = formData.get('customScores') as string | null;
    const customScores = customScoresJson ? JSON.parse(customScoresJson) : undefined;
    const forceFailure = formData.get('forceFailure') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No media file provided' }, { status: 400 });
    }

    // Resolve Persona
    let targetPersonaId = personaId;
    if (!targetPersonaId) {
      const activePersona = await prisma.persona.findFirst();
      if (!activePersona) {
        return NextResponse.json({ error: 'No active persona found. Create one first.' }, { status: 400 });
      }
      targetPersonaId = activePersona.id;
    }

    // 1. Process media (strip EXIF, generate thumbnail, create provenance manifest)
    const buffer = Buffer.from(await file.arrayBuffer());
    const media = await processMediaImage(buffer, targetPersonaId);

    // 2. Upload original (optimized) and thumbnail to storage
    const timestamp = Date.now();
    const cleanFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const mainKey = `${targetPersonaId}/${timestamp}_${cleanFilename}`;
    const thumbKey = `${targetPersonaId}/thumbs/${timestamp}_thumb_${cleanFilename}`;

    const [uploadedMain] = await Promise.all([
      storage.upload(media.optimizedBuffer, mainKey, file.type || 'image/jpeg'),
      storage.upload(media.thumbnailBuffer, thumbKey, 'image/jpeg'),
    ]);

    // 3. Run Pluggable Safety Gate Pipeline
    const tags = Array.isArray(JSON.parse(tagsString)) ? JSON.parse(tagsString) : [];
    const safetyResult = await runSafetyGatePipeline({
      buffer: media.optimizedBuffer,
      metadata: {
        prompt,
        tags,
        suitability,
      },
      customScores,
      forceClassifierFailure: forceFailure,
    });

    // 4. Record Asset in Database
    const asset = await prisma.asset.create({
      data: {
        personaId: targetPersonaId,
        storageKey: uploadedMain.storageKey,
        url: uploadedMain.url,
        type: file.type.startsWith('video/') ? 'video' : 'image',
        suitability,
        aiGenerated: true,
        provenanceMeta: JSON.stringify({
          ...media.provenanceMeta,
          original_filename: file.name,
          thumbnail_key: thumbKey,
        }),
        safetyStatus: safetyResult.status,
        safetyReasons: JSON.stringify(safetyResult.reasons),
        tags: JSON.stringify(tags),
      },
    });

    // 5. Record Safety Decision in AuditLog
    await logAuditEvent({
      userId: user?.userId,
      action: 'safety_decision',
      entity: 'Asset',
      entityId: asset.id,
      meta: {
        status: safetyResult.status,
        apparentAge: safetyResult.apparentAge,
        realPersonLikeness: safetyResult.realPersonLikeness,
        nsfwScore: safetyResult.nsfwScore,
        reasons: safetyResult.reasons,
      },
    });

    return NextResponse.json({
      success: true,
      asset,
      safetyResult,
    });
  } catch (error) {
    console.error('Asset upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Asset processing failed' },
      { status: 500 }
    );
  }
}
