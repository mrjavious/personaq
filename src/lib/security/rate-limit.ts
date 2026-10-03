interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const MAX_MAP_ENTRIES = 5000;

export const loginAttempts = new Map<string, RateLimitEntry>();
export const totpAttempts = new Map<string, RateLimitEntry>();
export const userGenerations = new Map<string, RateLimitEntry>();

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_BLOCK_MS = 30 * 60 * 1000; // 30 minutes

const TOTP_MAX_ATTEMPTS = 3;
const TOTP_BLOCK_MS = 15 * 60 * 1000; // 15 minutes

export function sweepExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of loginAttempts.entries()) {
    if (entry.resetAt < now) loginAttempts.delete(key);
  }
  for (const [key, entry] of totpAttempts.entries()) {
    if (entry.resetAt < now) totpAttempts.delete(key);
  }
  for (const [key, entry] of userGenerations.entries()) {
    if (entry.resetAt < now) userGenerations.delete(key);
  }
}

function enforceMapCapacity(map: Map<string, RateLimitEntry>): void {
  if (map.size > MAX_MAP_ENTRIES) {
    sweepExpiredEntries();
    if (map.size > MAX_MAP_ENTRIES) {
      // Evict oldest entries
      const keysToDelete = Array.from(map.keys()).slice(0, Math.floor(MAX_MAP_ENTRIES / 4));
      for (const k of keysToDelete) {
        map.delete(k);
      }
    }
  }
}

export function getClientIp(request: Request): string {
  if (process.env.TRUSTED_PROXY === 'true') {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
    const realIp = request.headers.get('x-real-ip');
    if (realIp) return realIp.trim();
  }
  // Untrusted proxy or direct connection: ignore spoofable client headers
  return 'direct-client';
}

export function checkLoginRateLimit(request: Request): { allowed: boolean; retryAfter?: number } {
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

export function recordLoginAttempt(request: Request, success: boolean): void {
  const ip = getClientIp(request);
  const now = Date.now();

  if (success) {
    loginAttempts.delete(ip);
    return;
  }

  enforceMapCapacity(loginAttempts);
  const entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_BLOCK_MS });
  } else {
    entry.count++;
  }
}

export function checkTotpRateLimit(
  request: Request,
  pendingUserId?: string | null,
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const ip = getClientIp(request);
  const ipKey = `ip:${ip}`;
  const ipEntry = totpAttempts.get(ipKey);

  if (ipEntry && ipEntry.resetAt < now) {
    totpAttempts.delete(ipKey);
  } else if (ipEntry && ipEntry.count >= TOTP_MAX_ATTEMPTS) {
    return { allowed: false, retryAfter: Math.ceil((ipEntry.resetAt - now) / 1000) };
  }

  if (pendingUserId) {
    const userKey = `user:${pendingUserId}`;
    const userEntry = totpAttempts.get(userKey);
    if (userEntry && userEntry.resetAt < now) {
      totpAttempts.delete(userKey);
    } else if (userEntry && userEntry.count >= TOTP_MAX_ATTEMPTS) {
      return { allowed: false, retryAfter: Math.ceil((userEntry.resetAt - now) / 1000) };
    }
  }

  return { allowed: true };
}

export function recordTotpAttempt(
  request: Request,
  success: boolean,
  pendingUserId?: string | null,
): void {
  const now = Date.now();
  const ip = getClientIp(request);
  const ipKey = `ip:${ip}`;
  const userKey = pendingUserId ? `user:${pendingUserId}` : null;

  if (success) {
    totpAttempts.delete(ipKey);
    if (userKey) totpAttempts.delete(userKey);
    return;
  }

  enforceMapCapacity(totpAttempts);

  // Record on IP
  const ipEntry = totpAttempts.get(ipKey);
  if (!ipEntry || ipEntry.resetAt < now) {
    totpAttempts.set(ipKey, { count: 1, resetAt: now + TOTP_BLOCK_MS });
  } else {
    ipEntry.count++;
  }

  // Record on pending user ID to prevent distributed brute-force
  if (userKey) {
    const userEntry = totpAttempts.get(userKey);
    if (!userEntry || userEntry.resetAt < now) {
      totpAttempts.set(userKey, { count: 1, resetAt: now + TOTP_BLOCK_MS });
    } else {
      userEntry.count++;
    }
  }
}

/**
 * Per-user, per-day generation cap helper.
 * Daily cap is read from DAILY_GENERATION_CAP env (defaults to 50).
 */
export function checkUserGenerationCap(userId: string): {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: number;
  retryAfterSeconds: number;
} {
  const limit = parseInt(process.env.DAILY_GENERATION_CAP || '50', 10);
  const now = Date.now();
  const entry = userGenerations.get(userId);

  if (entry && entry.resetAt < now) {
    userGenerations.delete(userId);
  }

  const currentCount = (userGenerations.get(userId)?.count) || 0;
  const remaining = Math.max(0, limit - currentCount);
  const resetAt = entry?.resetAt || (now + 24 * 60 * 60 * 1000);
  const retryAfterSeconds = Math.max(0, Math.ceil((resetAt - now) / 1000));

  return {
    allowed: currentCount < limit,
    remaining,
    limit,
    resetAt,
    retryAfterSeconds,
  };
}

export function recordUserGeneration(userId: string): void {
  const now = Date.now();
  enforceMapCapacity(userGenerations);
  const entry = userGenerations.get(userId);

  if (!entry || entry.resetAt < now) {
    // Reset window: 24 hours from first generation
    userGenerations.set(userId, { count: 1, resetAt: now + 24 * 60 * 60 * 1000 });
  } else {
    entry.count++;
  }
}
