import crypto from 'crypto';

// Simple in-memory cache with TTL (use Redis in production)
const cache = new Map<string, { value: string; expiresAt: number }>();

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

function generateCacheKey(prefix: string, input: unknown): string {
  const hash = crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
  return `${prefix}:${hash}`;
}

export async function getCachedResponse<T>(prefix: string, input: unknown): Promise<T | null> {
  const key = generateCacheKey(prefix, input);
  const entry = cache.get(key);

  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }

  try {
    return JSON.parse(entry.value) as T;
  } catch {
    return null;
  }
}

export async function setCachedResponse<T>(
  prefix: string,
  input: unknown,
  value: T,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<void> {
  const key = generateCacheKey(prefix, input);
  cache.set(key, {
    value: JSON.stringify(value),
    expiresAt: Date.now() + ttlMs,
  });
}

export function clearCache(): void {
  cache.clear();
}

// Periodic cleanup of expired entries
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt < now) {
      cache.delete(key);
    }
  }
}, 60_000).unref();
