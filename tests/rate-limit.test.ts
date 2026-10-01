import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkLoginRateLimit, recordLoginAttempt, checkTotpRateLimit, recordTotpAttempt } from '@/lib/security/rate-limit';

// Mock NextRequest
const createMockRequest = (ip = '127.0.0.1') =>
  ({
    headers: {
      get: (name: string) => {
        if (name === 'x-forwarded-for') return ip;
        if (name === 'x-real-ip') return ip;
        return null;
      },
    },
  }) as any;

describe('rate-limit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  describe('login rate limiting', () => {
    it('allows requests under the limit', () => {
      const request = createMockRequest();
      const result = checkLoginRateLimit(request);
      expect(result.allowed).toBe(true);
    });

    it('blocks requests after max attempts', () => {
      const request = createMockRequest();

      // Record 5 failed attempts
      for (let i = 0; i < 5; i++) {
        recordLoginAttempt(request, false);
      }

      const result = checkLoginRateLimit(request);
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('resets after successful login', () => {
      const request = createMockRequest();

      // Record 3 failed attempts
      for (let i = 0; i < 3; i++) {
        recordLoginAttempt(request, false);
      }

      // Successful login resets
      recordLoginAttempt(request, true);

      const result = checkLoginRateLimit(request);
      expect(result.allowed).toBe(true);
    });

    it('tracks different IPs separately', () => {
      const request1 = createMockRequest('192.168.1.1');
      const request2 = createMockRequest('192.168.1.2');

      // Block first IP
      for (let i = 0; i < 5; i++) {
        recordLoginAttempt(request1, false);
      }

      // Second IP should still be allowed
      const result = checkLoginRateLimit(request2);
      expect(result.allowed).toBe(true);
    });
  });

  describe('TOTP rate limiting', () => {
    it('allows requests under the limit', () => {
      const request = createMockRequest();
      const result = checkTotpRateLimit(request);
      expect(result.allowed).toBe(true);
    });

    it('blocks requests after max attempts', () => {
      const request = createMockRequest();

      // Record 3 failed attempts
      for (let i = 0; i < 3; i++) {
        recordTotpAttempt(request, false);
      }

      const result = checkTotpRateLimit(request);
      expect(result.allowed).toBe(false);
    });

    it('resets after successful verification', () => {
      const request = createMockRequest();

      // Record 2 failed attempts
      for (let i = 0; i < 2; i++) {
        recordTotpAttempt(request, false);
      }

      // Successful verification resets
      recordTotpAttempt(request, true);

      const result = checkTotpRateLimit(request);
      expect(result.allowed).toBe(true);
    });
  });
});
