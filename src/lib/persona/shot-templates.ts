import { PrismaClient } from '@prisma/client';

export interface ShotTemplateSeedItem {
  name: string;
  kind: 'portrait' | 'action' | 'full_body' | 'detail';
  framing: string;
  lens: string;
  aperture: string;
  cameraState: string;
  aspectRatio: string;
  defaultExpression: string;
  negativeText: string;
}

export const CANONICAL_SHOT_TEMPLATES: readonly ShotTemplateSeedItem[] = [
  {
    name: 'portrait 50mm T2',
    kind: 'portrait',
    framing: 'Medium close-up portrait, framed from mid-chest to top of head with flattering head-and-shoulders composition',
    lens: '50mm prime cinema lens',
    aperture: 'T2 (f/1.8)',
    cameraState: 'Eye-level, stable tripod mount, sharp subject focus on eyes with gentle background roll-off',
    aspectRatio: '4:5',
    defaultExpression: 'thoughtful glance',
    negativeText: 'no text, no logos, no stickers, no watermarks, no third-party branding',
  },
  {
    name: 'wide 35mm T2.8',
    kind: 'action',
    framing: 'Wide environmental action framing displaying full persona physique integrated harmoniously within architectural surroundings',
    lens: '35mm cinema wide prime lens',
    aperture: 'T2.8',
    cameraState: 'Slight dynamic low-angle, deep natural field of view, cinematic perspective',
    aspectRatio: '16:9',
    defaultExpression: 'calm deadpan',
    negativeText: 'no text, no logos, no stickers, no watermarks, no third-party branding',
  },
  {
    name: 'macro detail',
    kind: 'detail',
    framing: 'Extreme close-up macro framing focusing on authentic facial skin micro-pores, corneal eye catchlights, or delicate garment weave',
    lens: '100mm macro lens',
    aperture: 'f/2.8',
    cameraState: 'Locked static macro position, razor-thin depth of field, hyper-focused subject plane',
    aspectRatio: '1:1',
    defaultExpression: 'neutral',
    negativeText: 'no text, no logos, no stickers, no watermarks, no third-party branding',
  },
  {
    name: 'top-down',
    kind: 'action',
    framing: 'Overhead bird’s-eye perspective (90° top-down flat lay view) framing subject gracefully posed or interacting with environment',
    lens: '24mm wide prime lens',
    aperture: 'f/4',
    cameraState: 'High-overhead crane perspective pointing directly downwards, clean geometric symmetry',
    aspectRatio: '1:1',
    defaultExpression: 'soft half-smile',
    negativeText: 'no text, no logos, no stickers, no watermarks, no third-party branding',
  },
  {
    name: 'phone selfie',
    kind: 'portrait',
    framing: 'High handheld arm-length selfie angle framing face, neck, and shoulder with authentic modern front-camera perspective',
    lens: '24mm equivalent smartphone front camera (~24mm wide-angle equivalent)',
    aperture: 'f/2.2',
    cameraState: 'Handheld high angle with organic slight tilt and realistic handheld motion capture',
    aspectRatio: '9:16',
    defaultExpression: 'mid-laugh',
    negativeText: 'no text, no logos, no stickers, no watermarks, no third-party branding',
  },
  {
    name: 'candid 35mm',
    kind: 'full_body',
    framing: 'Full-length documentary candid framing capturing full body in authentic unposed natural motion',
    lens: '35mm f/1.4 prime lens on 35mm full frame sensor',
    aperture: 'f/2.0',
    cameraState: 'Waist-height candid snapshot perspective, documentary street photography alignment',
    aspectRatio: '4:5',
    defaultExpression: 'subtle closed-lip smile',
    negativeText: 'no text, no logos, no stickers, no watermarks, no third-party branding',
  },
] as const;

export async function seedShotTemplates(prisma: PrismaClient) {
  const seeded = [];
  for (const item of CANONICAL_SHOT_TEMPLATES) {
    const template = await prisma.shotTemplate.upsert({
      where: { name: item.name },
      update: {
        kind: item.kind,
        framing: item.framing,
        lens: item.lens,
        aperture: item.aperture,
        cameraState: item.cameraState,
        aspectRatio: item.aspectRatio,
        defaultExpression: item.defaultExpression,
        negativeText: item.negativeText,
      },
      create: {
        name: item.name,
        kind: item.kind,
        framing: item.framing,
        lens: item.lens,
        aperture: item.aperture,
        cameraState: item.cameraState,
        aspectRatio: item.aspectRatio,
        defaultExpression: item.defaultExpression,
        negativeText: item.negativeText,
      },
    });
    seeded.push(template);
  }
  return seeded;
}
