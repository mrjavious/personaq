import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const DEFAULT_KEY_HEX = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function getEncryptionKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: ENCRYPTION_KEY environment variable is required in production.');
    }
    return Buffer.from(DEFAULT_KEY_HEX.padEnd(64, '0').slice(0, 64), 'hex');
  }
  return Buffer.from(keyHex.padEnd(64, '0').slice(0, 64), 'hex');
}

/**
 * Encrypt sensitive credentials (e.g. platform API tokens) using AES-256-GCM.
 * Output format: iv:authTag:ciphertext (hex)
 */
export function encryptToken(plainText: string): string {
  if (!plainText) return '';
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt sensitive credentials using AES-256-GCM.
 */
export function decryptToken(encryptedPayload: string): string {
  if (!encryptedPayload) return '';
  try {
    const parts = encryptedPayload.split(':');
    if (parts.length !== 3) return '';

    const [ivHex, authTagHex, cipherHex] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return '';
  }
}
