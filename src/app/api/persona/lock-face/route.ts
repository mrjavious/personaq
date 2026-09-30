import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { logAuditEvent } from '@/lib/audit/logger';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { personaId, action = 'lock', faceImageUrl } = body;

    if (!personaId) {
      return NextResponse.json({ error: 'personaId is required' }, { status: 400 });
    }

    const persona = await prisma.persona.findUnique({
      where: { id: personaId },
    });

    if (!persona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
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

    // Default: Lock Face & Identity
    if (faceImageUrl) {
      const cleanRel = faceImageUrl.split('?')[0].replace(/^\//, '');
      const sourceDiskPath = path.resolve(process.cwd(), 'public', cleanRel);

      if (fs.existsSync(sourceDiskPath)) {
        fs.copyFileSync(sourceDiskPath, lockedFacePath);
        fs.copyFileSync(sourceDiskPath, baseFrontPath);
      }
    }

    // If locked_face.jpg doesn't exist, try base_front or avatarUrl
    if (!fs.existsSync(lockedFacePath)) {
      if (fs.existsSync(baseFrontPath)) {
        fs.copyFileSync(baseFrontPath, lockedFacePath);
      } else if (persona.avatarUrl) {
        const cleanAvatar = persona.avatarUrl.split('?')[0].replace(/^\//, '');
        const candidate = path.resolve(process.cwd(), 'public', cleanAvatar);
        if (fs.existsSync(candidate)) {
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
  } catch (error) {
    console.error('Error in /api/persona/lock-face:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update face lock status' },
      { status: 500 }
    );
  }
}
