import { describe, it, expect } from 'vitest';
import { getComplianceAuditReport } from '@/lib/compliance/service';

describe('Phase 5: Compliance Audit & Governance Scorecard', () => {
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
});
