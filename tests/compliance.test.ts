import { describe, it, expect } from 'vitest';
import { getComplianceAuditReport } from '@/lib/compliance/service';
import {
  isPlatformRuleStale,
  getPlatformRuleStalenessDays,
  getPlatformRuleHealthLevel,
  PLATFORM_RULE_STALE_DAYS,
  PLATFORM_RULE_CRITICAL_DAYS,
} from '@/lib/guardrails/rules';
import {
  runScheduledComplianceCheck,
  getLatestComplianceCheck,
  getComplianceHistory,
} from '@/lib/compliance/scheduler';

describe('Compliance Audit & Governance Scorecard', () => {
  it('computes an overall compliance report across accounts and posts', async () => {
    const report = await getComplianceAuditReport();

    expect(report).toBeDefined();
    expect(report.overallScore).toBeGreaterThanOrEqual(0);
    expect(report.overallScore).toBeLessThanOrEqual(100);
    expect(Array.isArray(report.accounts)).toBe(true);
    expect(report.postAudit).toBeDefined();
    expect(report.postAudit.adultAssetOnSfwViolations).toBe(0); // Guardrail 4 strictly upheld!
    expect(Array.isArray(report.alerts)).toBe(true);
  });

  it('audits each platform account for AI bio disclosure', async () => {
    const report = await getComplianceAuditReport();
    for (const acc of report.accounts) {
      expect(acc.platform).toBeDefined();
      expect(acc.handle).toBeDefined();
      expect(typeof acc.disclosureInBio).toBe('boolean');
      expect(typeof acc.isRuleStale).toBe('boolean');
    }
  });

  it('audits post variants for safety gate and AI label compliance', async () => {
    const report = await getComplianceAuditReport();
    expect(report.postAudit.safetyComplianceRate).toBeGreaterThanOrEqual(0);
    expect(report.postAudit.aiDisclosureComplianceRate).toBeGreaterThanOrEqual(0);
  });

  describe('Platform Rule Staleness & Health Verification', () => {
    it('accurately identifies fresh rules versus stale rules (> 90 days)', () => {
      expect(PLATFORM_RULE_STALE_DAYS).toBe(90);
      expect(PLATFORM_RULE_CRITICAL_DAYS).toBe(180);

      const now = new Date();
      expect(isPlatformRuleStale(now)).toBe(false);
      expect(getPlatformRuleHealthLevel(now)).toBe('healthy');
      expect(getPlatformRuleStalenessDays(now)).toBe(0);

      // 45 days ago -> healthy
      const fortyFiveDaysAgo = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
      expect(isPlatformRuleStale(fortyFiveDaysAgo)).toBe(false);
      expect(getPlatformRuleHealthLevel(fortyFiveDaysAgo)).toBe('healthy');

      // 95 days ago -> stale / warning
      const ninetyFiveDaysAgo = new Date(Date.now() - 95 * 24 * 60 * 60 * 1000);
      expect(isPlatformRuleStale(ninetyFiveDaysAgo)).toBe(true);
      expect(getPlatformRuleHealthLevel(ninetyFiveDaysAgo)).toBe('warning');

      // 200 days ago -> critical
      const twoHundredDaysAgo = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000);
      expect(isPlatformRuleStale(twoHundredDaysAgo)).toBe(true);
      expect(getPlatformRuleHealthLevel(twoHundredDaysAgo)).toBe('critical');

      // Null date -> stale
      expect(isPlatformRuleStale(null)).toBe(true);
      expect(getPlatformRuleHealthLevel(null)).toBe('critical');
    });
  });

  describe('Scheduled Compliance Checks & Snapshot Persistence', () => {
    it('executes scheduled compliance run, records snapshot in DB, and retrieves latest snapshot', async () => {
      const checkResult = await runScheduledComplianceCheck();

      expect(checkResult).toBeDefined();
      expect(checkResult.id).toBeDefined();
      expect(checkResult.overallScore).toBeGreaterThanOrEqual(0);
      expect(typeof checkResult.passed).toBe('boolean');

      // Retrieve latest compliance check
      const latest = await getLatestComplianceCheck();
      expect(latest).toBeDefined();
      expect(latest?.id).toBe(checkResult.id);
      expect(latest?.overallScore).toBe(checkResult.overallScore);
      expect(latest?.report).toBeDefined();

      // Retrieve compliance check history
      const history = await getComplianceHistory(5);
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history[0].id).toBe(checkResult.id);
    });
  });
});

