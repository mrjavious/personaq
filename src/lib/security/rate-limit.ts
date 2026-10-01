import { NextRequest } from 'next/server';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const loginAttempts = new Map<string, RateLimitEntry>();
const totpAttempts = new Map<string, RateLimitEntry>();

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOGIN_BLOCK_MS = 30 * 60 * 1000; // 30 minutes

const TOTP_MAX_ATTEMPTS = 3;
const TOTP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const TOTP_BLOCK_MS = 15 * 60 * 1000; // 15 minutes

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

export function checkLoginRateLimit(request: NextRequest): { allowed: boolean; retryAfter?: number } {
  const ip = getClientIp(request);
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (entry && entry.resetAt < now) {
    loginAttempts.delete(ip);
    return { allowed: true };
  }

  if (entry && entry.count >= LOGIN_MAX_ATTEMPTS) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  return { allowed: true };
}

export function recordLoginAttempt(request: NextRequest, success: boolean): void {
  const ip = getClientIp(request);
  const now = Date.now();

  if (success) {
    loginAttempts.delete(ip);
    return;
  }

  const entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_BLOCK_MS });
  } else {
    entry.count++;
  }
}

export function checkTotpRateLimit(request: NextRequest): { allowed: boolean; retryAfter?: number } {
  const ip = getClientIp(request);
  const now = Date.now();
  const entry = totpAttempts.get(ip);

  if (entry && entry.resetAt < now) {
    totpAttempts.delete(ip);
    return { allowed: true };
  }

  if (entry && entry.count >= TOTP_MAX_ATTEMPTS) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  return { allowed: true };
}

export function recordTotpAttempt(request: NextRequest, success: boolean): void {
  const ip = getClientIp(request);
  const now = Date.now();

  if (success) {
    totpAttempts.delete(ip);
    return;
  }

  const entry = totpAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    totpAttempts.set(ip, { count: 1, resetAt: now + TOTP_BLOCK_MS });
  } else {
    entry.count++;
  }
}
