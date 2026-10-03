import { prisma } from '@/lib/db';

// Simple DB-backed feature flag system
// In production, consider using LaunchDarkly, Unleash, or similar

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  description?: string;
}

// Default flags (used when DB is unavailable)
const DEFAULT_FLAGS: Record<string, boolean> = {
  'new-composer-ui': false,
  'advanced-analytics': false,
  'bulk-publishing': false,
  'ai-persona-builder': true,
  'safety-gate-v2': false,
  'multi-language': false,
  'dark-mode': true,
  'notifications': false,
};

export async function getFeatureFlag(key: string): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flag = await (prisma as any).featureFlag.findUnique({
      where: { key },
    });
    return flag?.enabled ?? DEFAULT_FLAGS[key] ?? false;
  } catch {
    return DEFAULT_FLAGS[key] ?? false;
  }
}

export async function getAllFeatureFlags(): Promise<FeatureFlag[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flags = await (prisma as any).featureFlag.findMany();
    return flags.map((f: { key: string; enabled: boolean; description?: string | null }) => ({
      key: f.key,
      enabled: f.enabled,
      description: f.description || undefined,
    }));
  } catch {
    return Object.entries(DEFAULT_FLAGS).map(([key, enabled]) => ({
      key,
      enabled,
    }));
  }
}

export async function setFeatureFlag(
  key: string,
  enabled: boolean,
  description?: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any).featureFlag.upsert({
    where: { key },
    create: { key, enabled, description },
    update: { enabled, description },
  });
}

// Helper to check if a feature is enabled (with caching)
const flagCache = new Map<string, { value: boolean; expiresAt: number }>();
const CACHE_TTL_MS = 60_000; // 1 minute

export async function isFeatureEnabled(key: string): Promise<boolean> {
  const cached = flagCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const value = await getFeatureFlag(key);
  flagCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

export function clearFlagCache(): void {
  flagCache.clear();
}
