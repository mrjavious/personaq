import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { logAuditEvent } from '@/lib/audit/logger';
import { withApi } from '@/lib/api/handler';
import fs from 'fs';
import path from 'path';

export const POST = withApi(
  async (request: Request) => {
    const body = await request.json();
    const { personaId, action = 'lock', faceImageUrl } = body;

    if (!personaId) {
      return NextResponse.json({ error: 'personaId is required', success: false }, { status: 400 });
    }

    const persona = await prisma.persona.findUnique({
      where: { id: personaId },
    });

    if (!persona) {
      return NextResponse.json({ error: 'Persona not found', success: false }, { status: 404 });
    }

    let parsedConfig: Record<string, unknown> = {};
    try {
      if (persona.visualModelConfig) {
        parsedConfig = JSON.parse(persona.visualModelConfig);
      }
    } catch {
      parsedConfig = {};
    }

    const personaDir = path.resolve(process.cwd(), `public/uploads/personas/${personaId}`);
    if (!fs.existsSync(personaDir)) {
      fs.mkdirSync(personaDir, { recursive: true });
    }

    const lockedFacePath = path.join(personaDir, 'locked_face.jpg');
    const baseFrontPath = path.join(personaDir, 'base_front.jpg');

    if (action === 'unlock') {
      parsedConfig.isFaceLocked = false;

      const updatedPersona = await prisma.persona.update({
        where: { id: personaId },
        data: {
          visualModelConfig: JSON.stringify(parsedConfig),
        },
      });

      const versionCount = await prisma.personaVersion.count({ where: { personaId } });
      await prisma.personaVersion.create({
        data: {
          personaId,
          versionNumber: versionCount + 1,
          snapshotJson: JSON.stringify(updatedPersona),
          changeSummary: 'Face identity unlocked',
        },
      });

      await logAuditEvent({
        action: 'persona_update',
        entity: 'Persona',
        entityId: personaId,
        meta: { type: 'face_unlocked', personaName: persona.name },
      });

      return NextResponse.json({
        success: true,
        isFaceLocked: false,
        persona: updatedPersona,
      });
    }

    const publicRoot = path.resolve(process.cwd(), 'public');

    // Default: Lock Face & Identity
    if (faceImageUrl && typeof faceImageUrl === 'string') {
      const cleanRel = faceImageUrl.split('?')[0].replace(/^\/+/, '');
      const sourceDiskPath = path.resolve(publicRoot, cleanRel);

      // Guard against path traversal attacks (e.g., ../../)
      if (sourceDiskPath.startsWith(publicRoot + path.sep) && fs.existsSync(sourceDiskPath)) {
        fs.copyFileSync(sourceDiskPath, lockedFacePath);
        fs.copyFileSync(sourceDiskPath, baseFrontPath);
      }
    }

    // If locked_face.jpg doesn't exist, try base_front or avatarUrl
    if (!fs.existsSync(lockedFacePath)) {
      if (fs.existsSync(baseFrontPath)) {
        fs.copyFileSync(baseFrontPath, lockedFacePath);
      } else if (persona.avatarUrl) {
        const cleanAvatar = persona.avatarUrl.split('?')[0].replace(/^\/+/, '');
        const candidate = path.resolve(publicRoot, cleanAvatar);
        if (candidate.startsWith(publicRoot + path.sep) && fs.existsSync(candidate)) {
          fs.copyFileSync(candidate, lockedFacePath);
          fs.copyFileSync(candidate, baseFrontPath);
        }
      }
    }

    const lockedFaceUrl = `/uploads/personas/${personaId}/locked_face.jpg`;
    parsedConfig.isFaceLocked = true;
    parsedConfig.lockedFaceUrl = lockedFaceUrl;
    parsedConfig.lockedAt = new Date().toISOString();

    const updatedPersona = await prisma.persona.update({
      where: { id: personaId },
      data: {
        avatarUrl: lockedFaceUrl,
        visualModelConfig: JSON.stringify(parsedConfig),
      },
    });

    // Ensure Asset record exists for the locked face identity anchor
    const existingAsset = await prisma.asset.findFirst({
      where: {
        personaId,
        url: lockedFaceUrl,
        deletedAt: null,
      },
    });

    if (!existingAsset) {
      await prisma.asset.create({
        data: {
          personaId,
          storageKey: `personas/${personaId}/locked_face.jpg`,
          url: lockedFaceUrl,
          type: 'image',
          suitability: 'sfw_safe',
          aiGenerated: true,
          safetyStatus: 'passed',
          tags: JSON.stringify(['identity_anchor', 'face_locked', persona.name]),
          provenanceMeta: JSON.stringify({
            ai_generated: true,
            persona_id: personaId,
            persona_name: persona.name,
            locked_at: parsedConfig.lockedAt,
            is_face_locked: true,
          }),
        },
      });
    }

    // Snapshot in PersonaVersion
    const versionCount = await prisma.personaVersion.count({ where: { personaId } });
    await prisma.personaVersion.create({
      data: {
        personaId,
        versionNumber: versionCount + 1,
        snapshotJson: JSON.stringify(updatedPersona),
        changeSummary: 'Face locked identity anchor updated',
      },
    });

    await logAuditEvent({
      action: 'persona_update',
      entity: 'Persona',
      entityId: personaId,
      meta: { type: 'face_locked', personaName: persona.name, lockedFaceUrl },
    });

    return NextResponse.json({
      success: true,
      isFaceLocked: true,
      lockedFaceUrl,
      persona: updatedPersona,
    });
  },
  { permission: 'manage_persona' },
);
