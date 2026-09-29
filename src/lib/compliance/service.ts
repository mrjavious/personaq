import { prisma } from '@/lib/db';
import { isRuleStale, getDaysSinceVerification } from '@/lib/rules/service';

export interface AccountChecklistItem {
  accountId: string;
  platform: string;
  handle: string;
  disclosureInBio: boolean;
  ruleVerified: boolean;
  ruleDaysSince: number;
  isRuleStale: boolean;
  apiStatus: string;
  status: 'compliant' | 'warning' | 'non_compliant';
}

export interface PostAuditSummary {
  totalPosts: number;
  totalVariants: number;
  passedSafetyGateCount: number;
  safetyComplianceRate: number; // percentage
  adultAssetOnSfwViolations: number; // Must strictly be 0 (Guardrail 4)
  aiDisclosureAppliedCount: number;
  aiDisclosureComplianceRate: number; // percentage
}

export interface ComplianceAuditReport {
  overallScore: number; // 0 - 100
  accounts: AccountChecklistItem[];
  postAudit: PostAuditSummary;
  staleRulesCount: number;
  missingDisclosuresCount: number;
  violationsCount: number;
  alerts: Array<{
    type: 'critical' | 'warning' | 'info';
    message: string;
    entity: string;
  }>;
}

/**
 * Computes comprehensive compliance audit scorecard (Section 5.10).
 */
export async function getComplianceAuditReport(): Promise<ComplianceAuditReport> {
  const alerts: Array<{ type: 'critical' | 'warning' | 'info'; message: string; entity: string }> = [];

  // 1. Fetch platform accounts & rules
  const accounts = await prisma.platformAccount.findMany();
  const rules = await prisma.platformRule.findMany();
  const ruleMap = new Map<string, { lastVerifiedAt: Date }>();
  for (const r of rules) {
    ruleMap.set(r.platform.toLowerCase(), { lastVerifiedAt: r.lastVerifiedAt });
  }

  let staleRulesCount = 0;
  let missingDisclosuresCount = 0;

  const accountChecklist: AccountChecklistItem[] = accounts.map((acc) => {
    const rule = ruleMap.get(acc.platform.toLowerCase());
    const ruleDate = rule?.lastVerifiedAt || acc.lastVerifiedAt;
    const ruleStale = isRuleStale(ruleDate);
    const ruleDays = getDaysSinceVerification(ruleDate);

    if (ruleStale) {
      staleRulesCount++;
      alerts.push({
        type: 'warning',
        message: `Platform rule for ${acc.platform} is stale (${ruleDays} days since verification). Review platform guidelines.`,
        entity: `Rule:${acc.platform}`,
      });
    }

    if (!acc.disclosureInBio) {
      missingDisclosuresCount++;
      alerts.push({
        type: 'critical',
        message: `Missing mandatory AI disclosure in bio for ${acc.platform} (${acc.handle}). Guardrail 3 violation risk.`,
        entity: `Account:${acc.platform}`,
      });
    }

    let status: 'compliant' | 'warning' | 'non_compliant' = 'compliant';
    if (!acc.disclosureInBio) {
      status = 'non_compliant';
    } else if (ruleStale) {
      status = 'warning';
    }

    return {
      accountId: acc.id,
      platform: acc.platform,
      handle: acc.handle,
      disclosureInBio: acc.disclosureInBio,
      ruleVerified: !ruleStale,
      ruleDaysSince: ruleDays,
      isRuleStale: ruleStale,
      apiStatus: acc.apiStatus,
      status,
    };
  });

  // 2. Audit Posts and Variants
  const posts = await prisma.post.findMany();
  const variants = await prisma.postVariant.findMany({
    include: {
      asset: true,
      platformAccount: true,
    },
  });

  const totalPosts = posts.length;
  const totalVariants = variants.length;

  let passedSafetyGateCount = 0;
  let adultAssetOnSfwViolations = 0;
  let aiDisclosureAppliedCount = 0;

  for (const v of variants) {
    if (v.aiLabelApplied) {
      aiDisclosureAppliedCount++;
    } else {
      alerts.push({
        type: 'warning',
        message: `Variant ${v.id.slice(0, 8)} on ${v.platformAccount.platform} does not have AI label applied.`,
        entity: `Variant:${v.id}`,
      });
    }

    if (v.asset) {
      if (v.asset.safetyStatus === 'passed') {
        passedSafetyGateCount++;
      }

      // Check Guardrail 4: SFW platforms cannot have adult_only assets
      const sfwPlatforms = ['instagram', 'x', 'threads', 'tiktok'];
      if (sfwPlatforms.includes(v.platformAccount.platform.toLowerCase()) && v.asset.suitability === 'adult_only') {
        adultAssetOnSfwViolations++;
        alerts.push({
          type: 'critical',
          message: `GUARDRAIL 4 BREACH: Variant ${v.id.slice(0, 8)} on SFW platform ${v.platformAccount.platform} attached adult_only asset ${v.asset.id.slice(0, 8)}!`,
          entity: `Guardrail4:${v.id}`,
        });
      }
    } else {
      // Text-only variant counts as safety-passed
      passedSafetyGateCount++;
    }
  }

  const safetyComplianceRate = totalVariants > 0
    ? Number(((passedSafetyGateCount / totalVariants) * 100).toFixed(1))
    : 100;

  const aiDisclosureComplianceRate = totalVariants > 0
    ? Number(((aiDisclosureAppliedCount / totalVariants) * 100).toFixed(1))
    : 100;

  // 3. Compute Overall Compliance Score
  let score = 100;
  // Deductions:
  if (adultAssetOnSfwViolations > 0) score -= (adultAssetOnSfwViolations * 30);
  if (missingDisclosuresCount > 0) score -= (missingDisclosuresCount * 15);
  if (staleRulesCount > 0) score -= (staleRulesCount * 5);
  if (safetyComplianceRate < 100) score -= Math.round((100 - safetyComplianceRate) * 0.3);
  if (aiDisclosureComplianceRate < 100) score -= Math.round((100 - aiDisclosureComplianceRate) * 0.2);
  const overallScore = Math.max(0, Math.min(100, score));

  return {
    overallScore,
    accounts: accountChecklist,
    postAudit: {
      totalPosts,
      totalVariants,
      passedSafetyGateCount,
      safetyComplianceRate,
      adultAssetOnSfwViolations,
      aiDisclosureAppliedCount,
      aiDisclosureComplianceRate,
    },
    staleRulesCount,
    missingDisclosuresCount,
    violationsCount: adultAssetOnSfwViolations,
    alerts,
  };
}
