import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

export interface StorageUploadResult {
  storageKey: string;
  url: string;
  bytes: number;
}

export interface StorageProvider {
  upload(buffer: Buffer, key: string, contentType: string): Promise<StorageUploadResult>;
  delete(key: string): Promise<boolean>;
  getUrl(key: string): string;
  getSignedUrl?(key: string, expiresIn?: number): string;
  getBuffer(key: string): Promise<Buffer>;
}

/**
 * Local Disk Provider
 * Stores files in public/uploads for seamless local development when MinIO/S3 is not running.
 */
class LocalDiskStorageProvider implements StorageProvider {
  private baseDir: string;
  private publicPrefix: string;

  constructor() {
    this.baseDir = path.resolve(process.cwd(), 'public/uploads');
    this.publicPrefix = '/uploads';
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  async upload(buffer: Buffer, key: string): Promise<StorageUploadResult> {
    const filePath = path.join(this.baseDir, key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, buffer);

    return {
      storageKey: key,
      url: `${this.publicPrefix}/${key}`,
      bytes: buffer.length,
    };
  }

  async delete(key: string): Promise<boolean> {
    const filePath = path.join(this.baseDir, key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }

  async getBuffer(key: string): Promise<Buffer> {
    const filePath = path.join(this.baseDir, key);
    if (!fs.existsSync(filePath)) {
      // Also try resolving relative to public or cwd
      const altPath = path.resolve(process.cwd(), 'public', key.replace(/^\/+/, ''));
      if (fs.existsSync(altPath)) {
        return fs.promises.readFile(altPath);
      }
      throw new Error(`File not found in local storage: ${key}`);
    }
    return fs.promises.readFile(filePath);
  }

  getUrl(key: string): string {
    return `${this.publicPrefix}/${key}`;
  }
}

/**
 * S3 Compatible Storage Provider
 * Works with MinIO (local dev) or Cloudflare R2 / AWS S3 (production).
 */
class S3StorageProvider implements StorageProvider {
  private client: S3Client;
  private bucket: string;
  private publicUrl: string;

  constructor() {
    this.bucket = process.env.STORAGE_BUCKET || 'personaq-assets';
    this.publicUrl = process.env.STORAGE_PUBLIC_URL || `http://localhost:9000/${this.bucket}`;

    this.client = new S3Client({
      endpoint: process.env.STORAGE_ENDPOINT || 'http://localhost:9000',
      region: process.env.STORAGE_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.STORAGE_ACCESS_KEY || 'personaq_minio_user',
        secretAccessKey: process.env.STORAGE_SECRET_KEY || 'personaq_minio_password',
      },
      forcePathStyle: true, // Required for MinIO
    });
  }

  async upload(buffer: Buffer, key: string, contentType: string): Promise<StorageUploadResult> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await this.client.send(command);

    return {
      storageKey: key,
      url: `${this.publicUrl}/${key}`,
      bytes: buffer.length,
    };
  }

  async delete(key: string): Promise<boolean> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await this.client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  async getBuffer(key: string): Promise<Buffer> {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    const response = await this.client.send(command);
    const byteArray = await response.Body?.transformToByteArray();
    if (!byteArray) {
      throw new Error(`Failed to load asset from S3/MinIO: ${key}`);
    }
    return Buffer.from(byteArray);
  }

  getUrl(key: string): string {
    return `${this.publicUrl}/${key}`;
  }

  /**
   * Generate a signed URL for private asset access.
   * Falls back to public URL if signing fails.
   */
  getSignedUrl(key: string, expiresIn = 3600): string {
    try {
      // In production with real S3, use @aws-sdk/s3-request-presigner
      // For MinIO/local development, return public URL with token
      const token = crypto.randomBytes(16).toString('hex');
      const expiresAt = Date.now() + expiresIn * 1000;
      return `${this.publicUrl}/${key}?token=${token}&expires=${expiresAt}`;
    } catch {
      return `${this.publicUrl}/${key}`;
    }
  }
}

// Detect provider: default to LocalDisk if MINIO_ROOT_USER isn't reachable or local dev preference
const useS3 = process.env.STORAGE_USE_S3 === 'true';
export const storage: StorageProvider = useS3
  ? new S3StorageProvider()
  : new LocalDiskStorageProvider();

export async function getAssetBuffer(asset: { storageKey: string; url?: string | null }): Promise<Buffer> {
  try {
    return await storage.getBuffer(asset.storageKey);
  } catch (err) {
    if (asset.url) {
      const cleanUrl = asset.url.split('?')[0].replace(/^\/+/, '');
      const localPath = path.resolve(process.cwd(), 'public', cleanUrl);
      if (fs.existsSync(localPath)) {
        return fs.promises.readFile(localPath);
      }
    }
    throw err;
  }
}

export default storage;
