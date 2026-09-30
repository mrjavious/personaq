import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { processMediaImage } from '@/lib/media/processor';

describe('Media Processing & Provenance', () => {
  it('should generate optimized buffer, 400px thumbnail, and provenance manifest', async () => {
    // Create an in-memory sample 800x600 test image using sharp
    const testBuffer = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 120, g: 60, b: 200 },
      },
    })
      .jpeg()
      .toBuffer();

    const result = await processMediaImage(testBuffer, 'persona_aria_123');

    // 1. Verify dimensions & format
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
    expect(result.aspectRatio).toBe('4:3'); // 800/600 is 4:3

    // 2. Verify thumbnail
    const thumbMeta = await sharp(result.thumbnailBuffer).metadata();
    expect(thumbMeta.width).toBe(400);
    expect(thumbMeta.height).toBe(400);

    // 3. Verify provenance metadata
    expect(result.provenanceMeta.ai_generated).toBe(true);
    expect(result.provenanceMeta.persona_id).toBe('persona_aria_123');
    expect(result.provenanceMeta.exif_stripped).toBe(true);
    expect(result.provenanceMeta.sha256).toBeDefined();
    expect(result.contentHashSha256.length).toBe(64); // SHA-256 hex string length
  });
});
