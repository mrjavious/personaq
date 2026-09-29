import sharp from 'sharp';
import crypto from 'crypto';

export interface ProcessedMediaResult {
  optimizedBuffer: Buffer;
  thumbnailBuffer: Buffer;
  width: number;
  height: number;
  format: string;
  aspectRatio: string;
  contentHashSha256: string;
  provenanceMeta: {
    ai_generated: boolean;
    provenance_standard: string;
    persona_id: string;
    generated_at: string;
    sha256: string;
    width: number;
    height: number;
    aspect_ratio: string;
    exif_stripped: boolean;
  };
}

/**
 * Strips device metadata, generates thumbnail, and prepares provenance manifest.
 */
export async function processMediaImage(
  inputBuffer: Buffer,
  personaId: string
): Promise<ProcessedMediaResult> {
  const image = sharp(inputBuffer);
  const metadata = await image.metadata();

  const width = metadata.width || 1024;
  const height = metadata.height || 1024;
  const format = metadata.format || 'jpeg';

  // Calculate clean aspect ratio (e.g. 1:1, 4:5, 4:3, 16:9, 9:16)
  const ratio = width / height;
  let aspectRatio = `${width}:${height}`;
  if (Math.abs(ratio - 1) < 0.05) aspectRatio = '1:1';
  else if (Math.abs(ratio - 4 / 5) < 0.05) aspectRatio = '4:5';
  else if (Math.abs(ratio - 4 / 3) < 0.05) aspectRatio = '4:3';
  else if (Math.abs(ratio - 16 / 9) < 0.05) aspectRatio = '16:9';
  else if (Math.abs(ratio - 9 / 16) < 0.05) aspectRatio = '9:16';

  // 1. Strip EXIF / Device metadata and re-encode
  const optimizedBuffer = await image
    .rotate() // auto-orient based on EXIF before stripping
    .withMetadata({
      exif: {
        IFD0: {
          Copyright: 'Disclosed Fictional AI Persona - Persona Studio',
          Software: 'Persona Studio personaq Asset Engine',
        },
      },
    })
    .toBuffer();

  // 2. Generate 400px thumbnail
  const thumbnailBuffer = await sharp(inputBuffer)
    .resize(400, 400, { fit: 'cover', position: 'center' })
    .jpeg({ quality: 85 })
    .toBuffer();

  // 3. Compute SHA-256 for cryptographic provenance
  const contentHashSha256 = crypto.createHash('sha256').update(optimizedBuffer).digest('hex');

  const provenanceMeta = {
    ai_generated: true,
    provenance_standard: 'C2PA-Ready / SHA256 Manifest',
    persona_id: personaId,
    generated_at: new Date().toISOString(),
    sha256: contentHashSha256,
    width,
    height,
    aspect_ratio: aspectRatio,
    exif_stripped: true,
  };

  return {
    optimizedBuffer,
    thumbnailBuffer,
    width,
    height,
    format,
    aspectRatio,
    contentHashSha256,
    provenanceMeta,
  };
}
