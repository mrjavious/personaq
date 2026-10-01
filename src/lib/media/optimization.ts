import sharp from 'sharp';

export interface OptimizationOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'jpeg' | 'webp' | 'avif' | 'png';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

const DEFAULT_OPTIONS: OptimizationOptions = {
  quality: 85,
  format: 'jpeg',
  fit: 'cover',
};

/**
 * Optimize an image buffer for web delivery.
 * Supports resizing, format conversion, and quality adjustment.
 */
export async function optimizeImage(
  buffer: Buffer,
  options: OptimizationOptions = {},
): Promise<{ buffer: Buffer; format: string; width: number; height: number }> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  let pipeline = sharp(buffer);

  // Resize if dimensions provided
  if (opts.width || opts.height) {
    pipeline = pipeline.resize(opts.width, opts.height, {
      fit: opts.fit,
      withoutEnlargement: true,
    });
  }

  // Convert format and set quality
  switch (opts.format) {
    case 'webp':
      pipeline = pipeline.webp({ quality: opts.quality });
      break;
    case 'avif':
      pipeline = pipeline.avif({ quality: opts.quality });
      break;
    case 'png':
      pipeline = pipeline.png({ quality: opts.quality });
      break;
    default:
      pipeline = pipeline.jpeg({ quality: opts.quality, mozjpeg: true });
  }

  const optimized = await pipeline.toBuffer({ resolveWithObject: true });

  return {
    buffer: optimized.data,
    format: opts.format || 'jpeg',
    width: optimized.info.width,
    height: optimized.info.height,
  };
}

/**
 * Generate multiple responsive sizes for an image.
 */
export async function generateResponsiveSizes(
  buffer: Buffer,
  sizes: Array<{ width: number; height?: number; suffix: string }>,
): Promise<Array<{ buffer: Buffer; suffix: string; width: number; height: number }>> {
  const results = await Promise.all(
    sizes.map(async (size) => {
      const optimized = await optimizeImage(buffer, {
        width: size.width,
        height: size.height,
        format: 'webp',
      });
      return {
        buffer: optimized.buffer,
        suffix: size.suffix,
        width: optimized.width,
        height: optimized.height,
      };
    }),
  );

  return results;
}

/**
 * Generate a thumbnail from an image buffer.
 */
export async function generateThumbnail(
  buffer: Buffer,
  size = 400,
): Promise<Buffer> {
  const result = await optimizeImage(buffer, {
    width: size,
    height: size,
    format: 'jpeg',
    quality: 80,
    fit: 'cover',
  });
  return result.buffer;
}

/**
 * Strip all metadata from an image (privacy).
 */
export async function stripMetadata(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .withMetadata({
      exif: {},
      icc: '',
    })
    .toBuffer();
}
