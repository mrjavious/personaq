import prisma from '@/lib/db/prisma';
import { isPlatformRuleStale } from '@/lib/guardrails/rules';
import { logAuditEvent } from '@/lib/audit/logger';

export interface FormattedPlatformRule {
  id: string;
  platform: string;
  rulesJson: string;
  parsedRules: Record<string, unknown>;
  lastVerifiedAt: Date;
  isStale: boolean;
  daysSinceVerification: number;
}

export function isRuleStale(lastVerifiedAt: Date | string | null): boolean {
  return isPlatformRuleStale(lastVerifiedAt);
}

export function getDaysSinceVerification(lastVerifiedAt: Date | string | null): number {
  if (!lastVerifiedAt) return 999;
  const daysSince = Math.floor(
    (Date.now() - new Date(lastVerifiedAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  return Math.max(0, daysSince);
}

export async function getAllPlatformRules(): Promise<FormattedPlatformRule[]> {
  const rules = await prisma.platformRule.findMany({
    orderBy: { platform: 'asc' },
  });

  return rules.map((rule) => {
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(rule.rulesJson);
    } catch {
      parsed = {};
    }

    const isStale = isPlatformRuleStale(rule.lastVerifiedAt);
    const daysSince = Math.floor(
      (Date.now() - new Date(rule.lastVerifiedAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      id: rule.id,
      platform: rule.platform,
      rulesJson: rule.rulesJson,
      parsedRules: parsed,
      lastVerifiedAt: rule.lastVerifiedAt,
      isStale,
      daysSinceVerification: Math.max(0, daysSince),
    };
  });
}

export async function updatePlatformRule(
  platform: string,
  rulesJson: string,
  userId?: string
) {
  // Validate that rulesJson is valid JSON
  try {
    JSON.parse(rulesJson);
  } catch {
    throw new Error('Invalid JSON format for platform rules');
  }

  const updated = await prisma.platformRule.upsert({
    where: { platform },
    update: {
      rulesJson,
      lastVerifiedAt: new Date(), // updating rules also resets verification to today
    },
    create: {
      platform,
      rulesJson,
      lastVerifiedAt: new Date(),
    },
  });

  await logAuditEvent({
    userId,
    action: 'settings_change',
    entity: 'PlatformRule',
    entityId: updated.id,
    meta: { platform, action: 'rules_updated' },
  });

  return updated;
}

export async function verifyPlatformRule(platform: string, userId?: string) {
  const updated = await prisma.platformRule.update({
    where: { platform },
    data: {
      lastVerifiedAt: new Date(),
    },
  });

  await logAuditEvent({
    userId,
    action: 'settings_change',
    entity: 'PlatformRule',
    entityId: updated.id,
    meta: { platform, action: 'rules_manually_verified' },
  });

  return updated;
}
