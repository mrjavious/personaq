import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Running faceStatus backfill for personas...');
  const personas = await prisma.persona.findMany();
  let updatedCount = 0;

  for (const persona of personas) {
    let isFaceLocked = false;
    try {
      if (persona.visualModelConfig) {
        const config = JSON.parse(persona.visualModelConfig);
        if (config.isFaceLocked === true || config.isFaceLocked === 'true') {
          isFaceLocked = true;
        }
      }
    } catch {
      isFaceLocked = false;
    }

    if (!isFaceLocked) continue;

    const lockedFacePath = path.resolve(process.cwd(), `public/uploads/personas/${persona.id}/locked_face.jpg`);
    const fileExists = fs.existsSync(lockedFacePath);

    if (fileExists) {
      const lockedFaceUrl = `/uploads/personas/${persona.id}/locked_face.jpg`;
      let asset = await prisma.asset.findFirst({
        where: {
          personaId: persona.id,
          url: lockedFaceUrl,
        },
      });

      if (!asset) {
        asset = await prisma.asset.create({
          data: {
            personaId: persona.id,
            storageKey: `personas/${persona.id}/locked_face.jpg`,
            url: lockedFaceUrl,
            type: 'image',
            kind: 'face_locked',
            suitability: 'sfw_safe',
            aiGenerated: true,
            safetyStatus: 'passed',
            tags: JSON.stringify(['identity_anchor', 'face_locked', persona.name]),
          },
        });
      } else {
        await prisma.asset.update({
          where: { id: asset.id },
          data: { kind: 'face_locked' },
        });
      }

      await prisma.persona.update({
        where: { id: persona.id },
        data: {
          faceStatus: 'locked',
          faceAssetId: asset.id,
          identityText: persona.appearanceNotes || 'Locked visual identity anchor',
        },
      });

      console.log(`✓ Backfilled persona ${persona.name} (${persona.id}) as faceStatus='locked'`);
      updatedCount++;
    }
  }

  console.log(`🎉 Backfill completed. Updated ${updatedCount} persona(s).`);
}

main()
  .catch((e) => {
    console.error('Backfill error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
