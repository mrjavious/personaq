import { describe, it, expect } from 'vitest';
import {
  generateTotpSecret,
  verifyTotpToken,
  generateBackupCodes,
  verifyAndConsumeBackupCode,
  getTotpAuthUrl,
} from '@/lib/auth/totp';
import { generateSync } from 'otplib';
import { hasPermission, isValidRole } from '@/lib/auth/rbac';

describe('Auth, 2FA, and RBAC', () => {
  describe('TOTP 2FA Verification', () => {
    it('should generate a valid secret and verify the corresponding token', () => {
      const secret = generateTotpSecret();
      expect(secret).toBeDefined();
      expect(secret.length).toBeGreaterThan(15);

      const token = generateSync({ secret });
      const isValid = verifyTotpToken(token, secret);
      expect(isValid).toBe(true);
    });

    it('should reject invalid or incorrect tokens', () => {
      const secret = generateTotpSecret();
      const isValid = verifyTotpToken('000000', secret);
      expect(isValid).toBe(false);
    });

    it('should format otpauth URI properly', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const uri = getTotpAuthUrl('creator@personaq.local', secret, 'personaq');
      expect(uri).toContain('otpauth://totp/personaq:creator%40personaq.local');
      expect(uri).toContain('secret=JBSWY3DPEHPK3PXP');
    });
  });

  describe('Backup Codes', () => {
    it('should generate single-use backup codes and consume them', () => {
      const { plainCodes, hashedCodes } = generateBackupCodes(4);
      expect(plainCodes).toHaveLength(4);
      expect(hashedCodes).toHaveLength(4);

      const firstCode = plainCodes[0];
      const result = verifyAndConsumeBackupCode(firstCode, hashedCodes);
      expect(result.valid).toBe(true);
      expect(result.remainingHashedCodes).toHaveLength(3);

      // Attempting to consume the same code again must fail
      const repeatResult = verifyAndConsumeBackupCode(firstCode, result.remainingHashedCodes);
      expect(repeatResult.valid).toBe(false);
    });
  });

  describe('RBAC Roles & Permissions', () => {
    it('should validate roles correctly', () => {
      expect(isValidRole('owner')).toBe(true);
      expect(isValidRole('admin')).toBe(true);
      expect(isValidRole('editor')).toBe(true);
      expect(isValidRole('anonymous')).toBe(false);
    });

    it('should enforce role boundaries', () => {
      expect(hasPermission('owner', 'manage_users')).toBe(true);
      expect(hasPermission('admin', 'manage_users')).toBe(false);
      expect(hasPermission('admin', 'compose_posts')).toBe(true);
      expect(hasPermission('editor', 'review_safety_overrides')).toBe(false);
      expect(hasPermission('editor', 'compose_posts')).toBe(true);
    });
  });
});
