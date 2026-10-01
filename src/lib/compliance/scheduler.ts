import { prisma } from '@/lib/db';
import { getComplianceAuditReport } from './service';
import { logAuditEvent } from '@/lib/audit/logger';

export interface ComplianceCheckResult {
  timestamp: string;
  overallScore: number;
  totalIssues: number;
  criticalIssues: number;
  warningIssues: number;
  passed: boolean;
}

/**
 * Runs a compliance check and stores the result.
 * This function is designed to be called by a cron job or scheduled task.
 */
export async function runScheduledComplianceCheck(): Promise<ComplianceCheckResult> {
  const timestamp = new Date().toISOString();

  try {
    // Generate compliance report
    const report = await getComplianceAuditReport();

    // Calculate summary metrics based on available report data
    const totalIssues = report.staleRulesCount + (report.postAudit?.adultAssetOnSfwViolations || 0);
    const criticalIssues = report.postAudit?.adultAssetOnSfwViolations || 0;
    const warningIssues = report.staleRulesCount;

    // Log the check
    await logAuditEvent({
      action: 'settings_change',
      entity: 'System',
      entityId: timestamp,
      meta: {
        type: 'compliance_check',
        overallScore: report.overallScore || 0,
        totalIssues,
        criticalIssues,
        warningIssues,
      },
    });

    // Alert if critical issues found
    if (criticalIssues > 0) {
      console.error(`COMPLIANCE ALERT: ${criticalIssues} critical issues found at ${timestamp}`);
      // In production, send email/Slack notification here
    }

    return {
      timestamp,
      overallScore: report.overallScore || 0,
      totalIssues,
      criticalIssues,
      warningIssues,
      passed: criticalIssues === 0,
    };
  } catch (error) {
    console.error('Compliance check failed:', error);
    throw error;
  }
}

/**
 * Get the latest compliance check result.
 */
export async function getLatestComplianceCheck(): Promise<ComplianceCheckResult | null> {
  // This would query the ComplianceSnapshot table once it's migrated
  // For now, return null until the migration is applied
  return null;
}

/**
 * Get compliance check history.
 */
export async function getComplianceHistory(limit = 30): Promise<ComplianceCheckResult[]> {
  // This would query the ComplianceSnapshot table once it's migrated
  // For now, return empty array until the migration is applied
  return [];
}
