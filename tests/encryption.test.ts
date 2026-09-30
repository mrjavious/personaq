import { describe, it, expect } from 'vitest';
import { encryptToken, decryptToken } from '@/lib/security/encryption';

describe('Token Security & Encryption (Section 3)', () => {
  it('should encrypt and decrypt tokens using AES-256-GCM', () => {
    const originalSecret = 'IG_ACCESS_TOKEN_XYZ_1234567890';
    const encrypted = encryptToken(originalSecret);

    expect(encrypted).toBeDefined();
    expect(encrypted).not.toBe(originalSecret);
    expect(encrypted.split(':')).toHaveLength(3); // iv:authTag:ciphertext

    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(originalSecret);
  });

  it('should safely return empty string on tampered payload or invalid format', () => {
    const invalidPayload = 'bad:payload';
    expect(decryptToken(invalidPayload)).toBe('');

    const tampered = '0123456789abcdef01234567:0123456789abcdef0123456789abcdef:badhex';
    expect(decryptToken(tampered)).toBe('');
  });
});
