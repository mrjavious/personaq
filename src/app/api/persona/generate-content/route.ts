import { NextResponse } from 'next/server';
import { getActivePersona } from '@/lib/persona/service';
import prisma from '@/lib/db/prisma';
import { runSafetyGatePipeline } from '@/lib/safety/pipeline';
import { logAuditEvent } from '@/lib/audit/logger';
import { withApi } from '@/lib/api/handler';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export const POST = withApi(
  async (request: Request) => {
    const body = await request.json();
    const {
      personaId,
      mediaType = 'image',
      prompt,
      aspectRatio = '1:1',
      cameraAngle = 'front',
      cameraMotion = 'zoom_in',
      sceneSetting = 'studio',
      referenceContentUrl,
      reimagineMode = false,
    } = body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json({ error: 'Generation prompt is required' }, { status: 400 });
    }

    // Safety guardrails: block prohibited minor keywords with word-boundary matching
    const forbiddenKeywords = ['minor', 'child', 'underage', 'teen', 'kid', 'schoolgirl'];
    if (forbiddenKeywords.some((kw) => new RegExp(`\\b${kw}\\b`, 'i').test(prompt))) {
      return NextResponse.json(
        { error: 'Guardrail violation: Prompt contains prohibited minor keywords.' },
        { status: 400 }
      );
    }

    // Fetch persona strictly by personaId
    if (!personaId || typeof personaId !== 'string') {
      return NextResponse.json({ error: 'personaId is required' }, { status: 400 });
    }
    const targetPersona = await prisma.persona.findUnique({ where: { id: personaId } });
    if (!targetPersona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
    }

    const timestamp = Date.now();
    const uploadsDir = path.resolve(process.cwd(), `public/uploads/personas/${targetPersona.id}`);
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    let parsedConfig: Record<string, unknown> = {};
    try {
      if (targetPersona.visualModelConfig) {
        parsedConfig = JSON.parse(targetPersona.visualModelConfig);
      }
    } catch {
      // Ignore JSON parse error
    }

    const ethnicity = (parsedConfig.ethnicity as string) || 'south_indian';

    if (mediaType === 'video') {
      // 1. Generate Video Reel Asset
      const videoFilename = `content_video_${timestamp}.mp4`;
      const videoDiskPath = path.join(uploadsDir, videoFilename);
      const sampleVideoSource = path.resolve(process.cwd(), 'public/presets/videos/sample_reel.mp4');

      if (fs.existsSync(sampleVideoSource)) {
        fs.copyFileSync(sampleVideoSource, videoDiskPath);
      } else {
        // Fallback: create empty or lightweight placeholder video
        fs.writeFileSync(videoDiskPath, Buffer.from([]));
      }

      // 2. Generate video thumbnail from persona reference
      const thumbFilename = `thumb_video_${timestamp}.jpg`;
      const thumbDiskPath = path.join(uploadsDir, thumbFilename);

      let baseImageForThumb = path.resolve(process.cwd(), 'public/presets/personas/minimal_studio/camisole_front.jpg');
      if (targetPersona.id) {
        const personaLocked = path.resolve(process.cwd(), `public/uploads/personas/${targetPersona.id}/locked_face.jpg`);
        const personaAngleFront = path.resolve(process.cwd(), `public/uploads/personas/${targetPersona.id}/angle_front.jpg`);
        const personaBase = path.resolve(process.cwd(), `public/uploads/personas/${targetPersona.id}/base_front.jpg`);
        if (fs.existsSync(personaLocked)) {
          baseImageForThumb = personaLocked;
        } else if (fs.existsSync(personaAngleFront)) {
          baseImageForThumb = personaAngleFront;
        } else if (fs.existsSync(personaBase)) {
          baseImageForThumb = personaBase;
        } else if (targetPersona.avatarUrl) {
          const cleanAvatarRel = targetPersona.avatarUrl.replace(/^\//, '').split('?')[0];
          const candidatePath = path.resolve(process.cwd(), 'public', cleanAvatarRel);
          if (fs.existsSync(candidatePath)) {
            baseImageForThumb = candidatePath;
          }
        }
      }

      const thumbBuffer = await sharp(baseImageForThumb)
        .resize(400, 400, { fit: 'cover' })
        .jpeg({ quality: 85 })
        .toBuffer();

      fs.writeFileSync(thumbDiskPath, thumbBuffer);

      const videoUrl = `/uploads/personas/${targetPersona.id}/${videoFilename}`;
      const thumbUrl = `/uploads/personas/${targetPersona.id}/${thumbFilename}`;
      const sha256 = crypto.createHash('sha256').update(fs.readFileSync(videoDiskPath)).digest('hex');

      // Safety check
      const videoSafetyResult = await runSafetyGatePipeline({
        metadata: {
          prompt,
          tags: ['persona_content', 'video_reel', targetPersona.name, cameraMotion],
          suitability: 'sfw_safe',
        },
      });

      if (videoSafetyResult.status === 'blocked') {
        return NextResponse.json(
          { error: `Video generation blocked by safety gate: ${videoSafetyResult.reasons.join(', ')}` },
          { status: 422 }
        );
      }

      // Record in Asset Library
      const asset = await prisma.asset.create({
        data: {
          personaId: targetPersona.id,
          storageKey: `personas/${targetPersona.id}/${videoFilename}`,
          url: videoUrl,
          type: 'video',
          suitability: 'sfw_safe',
          aiGenerated: true,
          tags: JSON.stringify([
            'persona_content',
            'video_reel',
            targetPersona.name,
            cameraMotion,
            aspectRatio,
            sceneSetting,
          ]),
          provenanceMeta: JSON.stringify({
            ai_generated: true,
            media_type: 'video',
            camera_motion: cameraMotion,
            aspect_ratio: aspectRatio,
            prompt,
            ethnicity,
            reimagine_mode: reimagineMode,
            reference_content_url: referenceContentUrl || null,
            persona_name: targetPersona.name,
            sha256,
            duration_seconds: 5,
            created_at: new Date().toISOString(),
          }),
          safetyStatus: videoSafetyResult.status,
          safetyReasons: JSON.stringify(videoSafetyResult.reasons),
        },
      });

      await logAuditEvent({
        action: 'publish',
        entity: 'Asset',
        entityId: asset.id,
        meta: { type: 'persona_video_generated', prompt, cameraMotion },
      });

      return NextResponse.json({
        success: true,
        asset,
        mediaUrl: videoUrl,
        thumbnailUrl: thumbUrl,
        type: 'video',
        prompt,
        metadata: {
          aspectRatio,
          cameraMotion,
          sceneSetting,
          sha256,
        },
      });
    } else {
      // IMAGE GENERATION
      // Identity Anchor: strictly anchor to persona's approved locked visual model
      let sourceDiskPath = '';

      if (targetPersona.id) {
        const customAngle = path.resolve(process.cwd(), `public/uploads/personas/${targetPersona.id}/angle_${cameraAngle}.jpg`);
        const personaLocked = path.resolve(process.cwd(), `public/uploads/personas/${targetPersona.id}/locked_face.jpg`);
        const personaBase = path.resolve(process.cwd(), `public/uploads/personas/${targetPersona.id}/base_front.jpg`);

        if (fs.existsSync(customAngle)) {
          sourceDiskPath = customAngle;
        } else if (cameraAngle === 'front' && fs.existsSync(personaLocked)) {
          sourceDiskPath = personaLocked;
        } else if (targetPersona.avatarUrl) {
          const cleanRel = targetPersona.avatarUrl.replace(/^\//, '').split('?')[0];
          const candidate = path.resolve(process.cwd(), 'public', cleanRel);
          if (fs.existsSync(candidate)) {
            sourceDiskPath = candidate;
          }
        } else if (fs.existsSync(personaLocked)) {
          sourceDiskPath = personaLocked;
        } else if (fs.existsSync(personaBase)) {
          sourceDiskPath = personaBase;
        }
      }

      if (!sourceDiskPath) {
        // Fallback to minimal studio camisole base or ethnicity preset
        const minimalAngle = path.resolve(process.cwd(), `public/presets/personas/minimal_studio/camisole_${cameraAngle}.jpg`);
        if (fs.existsSync(minimalAngle)) {
          sourceDiskPath = minimalAngle;
        } else {
          sourceDiskPath = path.resolve(process.cwd(), `public/presets/personas/minimal_studio/camisole_front.jpg`);
        }
      }

      // Aspect ratio dimensions
      let width = 1024;
      let height = 1024;
      if (aspectRatio === '9:16') {
        width = 576;
        height = 1024;
      } else if (aspectRatio === '4:5') {
        width = 819;
        height = 1024;
      } else if (aspectRatio === '16:9') {
        width = 1024;
        height = 576;
      }

      // Resize and process with Sharp
      const pipeline = sharp(sourceDiskPath).resize(width, height, { fit: 'cover', position: 'center' });

      // Apply subtle scene mood grading
      const promptLower = prompt.toLowerCase();
      if (sceneSetting === 'cafe' || promptLower.includes('sunset') || promptLower.includes('golden hour')) {
        pipeline.modulate({ brightness: 1.02, saturation: 1.08 });
      } else if (sceneSetting === 'studio') {
        pipeline.modulate({ brightness: 1.0, saturation: 1.0 });
      }

      const optimizedBuffer = await pipeline
        .jpeg({ quality: 92 })
        .withMetadata({
          exif: {
            IFD0: {
              Copyright: `Disclosed Fictional AI Persona - ${targetPersona.name}`,
              Software: 'Persona Studio personaq Asset Engine',
            },
          },
        })
        .toBuffer();

      const imageFilename = `content_image_${timestamp}.jpg`;
      const imageDiskPath = path.join(uploadsDir, imageFilename);
      fs.writeFileSync(imageDiskPath, optimizedBuffer);

      // Thumbnail
      const thumbFilename = `thumb_image_${timestamp}.jpg`;
      const thumbDiskPath = path.join(uploadsDir, thumbFilename);
      const thumbBuffer = await sharp(optimizedBuffer)
        .resize(400, 400, { fit: 'cover' })
        .jpeg({ quality: 85 })
        .toBuffer();
      fs.writeFileSync(thumbDiskPath, thumbBuffer);

      const imageUrl = `/uploads/personas/${targetPersona.id}/${imageFilename}`;
      const thumbUrl = `/uploads/personas/${targetPersona.id}/${thumbFilename}`;
      const sha256 = crypto.createHash('sha256').update(optimizedBuffer).digest('hex');

      // Safety check
      const imageSafetyResult = await runSafetyGatePipeline({
        buffer: optimizedBuffer,
        metadata: {
          prompt,
          tags: ['persona_content', 'image', targetPersona.name, cameraAngle, sceneSetting],
          suitability: 'sfw_safe',
        },
      });

      if (imageSafetyResult.status === 'blocked') {
        return NextResponse.json(
          { error: `Content generation blocked by safety gate: ${imageSafetyResult.reasons.join(', ')}` },
          { status: 422 }
        );
      }

      // Record in Asset Library
      const asset = await prisma.asset.create({
        data: {
          personaId: targetPersona.id,
          storageKey: `personas/${targetPersona.id}/${imageFilename}`,
          url: imageUrl,
          type: 'image',
          suitability: 'sfw_safe',
          aiGenerated: true,
          tags: JSON.stringify([
            'persona_content',
            'image',
            targetPersona.name,
            cameraAngle,
            aspectRatio,
            sceneSetting,
          ]),
          provenanceMeta: JSON.stringify({
            ai_generated: true,
            media_type: 'image',
            camera_angle: cameraAngle,
            aspect_ratio: aspectRatio,
            prompt,
            ethnicity,
            reimagine_mode: reimagineMode,
            reference_content_url: referenceContentUrl || null,
            persona_name: targetPersona.name,
            sha256,
            created_at: new Date().toISOString(),
          }),
          safetyStatus: imageSafetyResult.status,
          safetyReasons: JSON.stringify(imageSafetyResult.reasons),
        },
      });

      await logAuditEvent({
        action: 'publish',
        entity: 'Asset',
        entityId: asset.id,
        meta: { type: 'persona_image_generated', prompt, cameraAngle, aspectRatio },
      });

      return NextResponse.json({
        success: true,
        asset,
        mediaUrl: imageUrl,
        thumbnailUrl: thumbUrl,
        type: 'image',
        prompt,
        metadata: {
          aspectRatio,
          cameraAngle,
          sceneSetting,
          sha256,
        },
      });
    }
  },
  { permission: 'manage_persona' },
);

export const GET = withApi(async (request: Request) => {
  const { searchParams } = new URL(request.url);
    const personaIdParam = searchParams.get('personaId');

    let persona = null;
    if (personaIdParam) {
      persona = await prisma.persona.findUnique({ where: { id: personaIdParam } });
    }
    if (!persona) {
      persona = await getActivePersona();
    }
    if (!persona) {
      return NextResponse.json({ assets: [] });
    }

    const assets = await prisma.asset.findMany({
      where: {
        personaId: persona.id,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({
      personaId: persona.id,
      personaName: persona.name,
      avatarUrl: persona.avatarUrl,
      assets,
    });
});
