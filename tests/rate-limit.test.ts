import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  checkLoginRateLimit,
  recordLoginAttempt,
  checkTotpRateLimit,
  recordTotpAttempt,
  checkUserGenerationCap,
  recordUserGeneration,
  loginAttempts,
  totpAttempts,
  userGenerations,
  getClientIp,
  getRateLimitKey,
  checkApiRateLimit,
  apiRequestLimits,
  sweepExpiredEntries,
} from '@/lib/security/rate-limit';

const createMockRequest = (ip = '127.0.0.1'): Request =>
  new Request('http://localhost:3000/api/auth/login', {
    headers: {
      'x-forwarded-for': ip,
      'x-real-ip': ip,
    },
  });

describe('rate-limit', () => {
  const originalTrustedProxy = process.env.TRUSTED_PROXY;

  beforeEach(() => {
    vi.useFakeTimers();
    loginAttempts.clear();
    totpAttempts.clear();
    userGenerations.clear();
    apiRequestLimits.clear();
    process.env.TRUSTED_PROXY = 'true';
  });

  afterEach(() => {
    process.env.TRUSTED_PROXY = originalTrustedProxy;
    vi.useRealTimers();
  });

  describe('trusted proxy and IP extraction', () => {
    it('extracts IP from x-forwarded-for when TRUST_PROXY is 1', () => {
      delete process.env.TRUSTED_PROXY;
      process.env.TRUST_PROXY = '1';
      const req = createMockRequest('203.0.113.195, 198.51.100.1');
      expect(getClientIp(req)).toBe('203.0.113.195');
    });

    it('extracts IP from x-forwarded-for when TRUSTED_PROXY is true', () => {
      delete process.env.TRUST_PROXY;
      process.env.TRUSTED_PROXY = 'true';
      const req = createMockRequest('203.0.113.195, 198.51.100.1');
      expect(getClientIp(req)).toBe('203.0.113.195');
    });

    it('ignores client IP headers and falls back to direct-client when TRUST_PROXY is not 1', () => {
      delete process.env.TRUSTED_PROXY;
      process.env.TRUST_PROXY = '0';
      const req = createMockRequest('203.0.113.195');
      expect(getClientIp(req)).toBe('direct-client');
    });
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

    it('tracks different IPs separately when proxy is trusted', () => {
      process.env.TRUSTED_PROXY = 'true';
      const request1 = createMockRequest('192.168.1.1');
      const request2 = createMockRequest('192.168.1.2');

      // Block first IP
      for (let i = 0; i < 5; i++) {
        recordLoginAttempt(request1, false);
      }

      // First IP is blocked
      expect(checkLoginRateLimit(request1).allowed).toBe(false);
      // Second IP should still be allowed
      const result = checkLoginRateLimit(request2);
      expect(result.allowed).toBe(true);
    });
  });

  describe('TOTP rate limiting and distributed lockout', () => {
    it('allows requests under the limit', () => {
      const request = createMockRequest();
      const result = checkTotpRateLimit(request);
      expect(result.allowed).toBe(true);
    });

    it('blocks requests after max attempts on same IP', () => {
      const request = createMockRequest();

      // Record 3 failed attempts
      for (let i = 0; i < 3; i++) {
        recordTotpAttempt(request, false);
      }

      const result = checkTotpRateLimit(request);
      expect(result.allowed).toBe(false);
    });

    it('blocks user across rotating IPs when target user ID is provided', () => {
      process.env.TRUSTED_PROXY = 'true';
      const targetUserId = 'user_victim_123';

      // 3 failed attempts from 3 completely different IPs for the same user
      recordTotpAttempt(createMockRequest('1.1.1.1'), false, targetUserId);
      recordTotpAttempt(createMockRequest('2.2.2.2'), false, targetUserId);
      recordTotpAttempt(createMockRequest('3.3.3.3'), false, targetUserId);

      // Now an attempt from a brand new 4th IP for this user must be blocked
      const attempt4 = createMockRequest('4.4.4.4');
      const result = checkTotpRateLimit(attempt4, targetUserId);
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);

      // But another user on the 4th IP is not blocked
      const otherUserResult = checkTotpRateLimit(attempt4, 'other_user_456');
      expect(otherUserResult.allowed).toBe(true);
    });

    it('resets after successful verification', () => {
      const request = createMockRequest();
      const userId = 'user_abc';

      for (let i = 0; i < 2; i++) {
        recordTotpAttempt(request, false, userId);
      }

      recordTotpAttempt(request, true, userId);

      const result = checkTotpRateLimit(request, userId);
      expect(result.allowed).toBe(true);
    });
  });

  describe('generation cap rate limiting', () => {
    it('enforces generation cap per user', () => {
      process.env.DAILY_GENERATION_CAP = '10';
      const userId = 'user_gen_test';

      for (let i = 0; i < 10; i++) {
        const check = checkUserGenerationCap(userId);
        expect(check.allowed).toBe(true);
        recordUserGeneration(userId);
      }

      // 11th should be capped
      const capped = checkUserGenerationCap(userId);
      expect(capped.allowed).toBe(false);
      expect(capped.retryAfterSeconds).toBeGreaterThan(0);

      // Advance time beyond 24h window
      vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1000);
      const resetCheck = checkUserGenerationCap(userId);
      expect(resetCheck.allowed).toBe(true);
    });
  });

  describe('authenticated user-keyed rate limiting', () => {
    it('keys by user:userId when user is provided', () => {
      const req = createMockRequest('10.0.0.1');
      expect(getRateLimitKey(req, { userId: 'user_123' })).toBe('user:user_123');
      expect(getRateLimitKey(req, 'user_456')).toBe('user:user_456');
    });

    it('falls back to ip:clientIp when unauthenticated', () => {
      process.env.TRUSTED_PROXY = 'true';
      const req = createMockRequest('198.51.100.42');
      expect(getRateLimitKey(req, null)).toBe('ip:198.51.100.42');
      expect(getRateLimitKey(req, undefined)).toBe('ip:198.51.100.42');
    });

    it('tracks API requests by user regardless of rotating IP', () => {
      const user = { userId: 'user_rotating_ip' };
      const reqIp1 = createMockRequest('10.0.0.1');
      const reqIp2 = createMockRequest('10.0.0.2');

      // Make 3 requests for this user with maxRequests: 3
      checkApiRateLimit(reqIp1, user, { maxRequests: 3 });
      checkApiRateLimit(reqIp2, user, { maxRequests: 3 });
      const third = checkApiRateLimit(reqIp1, user, { maxRequests: 3 });
      expect(third.allowed).toBe(true);
      expect(third.remaining).toBe(0);

      // 4th request from any IP for this user should be rate limited
      const fourth = checkApiRateLimit(reqIp2, user, { maxRequests: 3 });
      expect(fourth.allowed).toBe(false);
      expect(fourth.retryAfter).toBeGreaterThan(0);
    });

    it('tracks login attempts by user email across rotating IPs', () => {
      const email = 'victim@example.com';
      const req1 = createMockRequest('10.0.0.1');
      const req2 = createMockRequest('10.0.0.2');
      const req3 = createMockRequest('10.0.0.3');

      // 5 failed login attempts for victim across different IPs
      recordLoginAttempt(req1, false, email);
      recordLoginAttempt(req2, false, email);
      recordLoginAttempt(req3, false, email);
      recordLoginAttempt(req1, false, email);
      recordLoginAttempt(req2, false, email);

      // Subsequent attempt from a new 4th IP for this email is blocked
      const req4 = createMockRequest('10.0.0.4');
      const check = checkLoginRateLimit(req4, email);
      expect(check.allowed).toBe(false);
    });
  });

  describe('sweeping expired entries', () => {
    it('sweeps expired entries properly', () => {
      const req = createMockRequest('10.0.0.1');
      recordLoginAttempt(req, false);
      expect(loginAttempts.size).toBe(1);

      // Advance time beyond 30 min block
      vi.advanceTimersByTime(31 * 60 * 1000);
      sweepExpiredEntries();
      expect(loginAttempts.size).toBe(0);
    });
  });
});
