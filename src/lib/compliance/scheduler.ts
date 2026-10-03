import { prisma } from '@/lib/db';
import { getComplianceAuditReport, ComplianceAuditReport } from './service';
import { logAuditEvent } from '@/lib/audit/logger';

export interface ComplianceCheckResult {
  id?: string;
  timestamp: string;
  overallScore: number;
  totalIssues: number;
  criticalIssues: number;
  warningIssues: number;
  passed: boolean;
  report?: ComplianceAuditReport;
}

/**
 * Runs a compliance check and stores the result snapshot.
 * This function is designed to be called by a cron job or scheduled task.
 */
export async function runScheduledComplianceCheck(): Promise<ComplianceCheckResult> {
  const timestamp = new Date().toISOString();

  try {
    // 1. Generate comprehensive compliance report
    const report = await getComplianceAuditReport();

    // 2. Calculate summary metrics based on report data
    const criticalIssues =
      (report.postAudit?.adultAssetOnSfwViolations || 0) +
      (report.missingDisclosuresCount || 0);
    const warningIssues = report.staleRulesCount;
    const totalIssues = criticalIssues + warningIssues;

    // 3. Persist snapshot to database
    const snapshot = await prisma.complianceSnapshot.create({
      data: {
        overallScore: report.overallScore || 0,
        totalIssues,
        criticalIssues,
        warningIssues,
        reportJson: JSON.stringify(report),
      },
    });

    // 4. Log tamper-evident audit event
    await logAuditEvent({
      action: 'compliance_check',
      entity: 'ComplianceSnapshot',
      entityId: snapshot.id,
      meta: {
        type: 'scheduled_compliance_check',
        overallScore: report.overallScore || 0,
        totalIssues,
        criticalIssues,
        warningIssues,
        staleRulesCount: report.staleRulesCount,
        violationsCount: report.violationsCount,
      },
    });

    // 5. Alert if critical issues found
    if (criticalIssues > 0) {
      console.warn(
        `COMPLIANCE ALERT: ${criticalIssues} critical compliance issues detected at ${timestamp}`
      );
    }

    return {
      id: snapshot.id,
      timestamp: snapshot.createdAt.toISOString(),
      overallScore: snapshot.overallScore,
      totalIssues,
      criticalIssues,
      warningIssues,
      passed: criticalIssues === 0,
      report,
    };
  } catch (error) {
    console.error('Scheduled compliance check failed:', error);
    throw error;
  }
}

/**
 * Get the latest compliance check result from the database snapshot.
 */
export async function getLatestComplianceCheck(): Promise<ComplianceCheckResult | null> {
  const snapshot = await prisma.complianceSnapshot.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  if (!snapshot) {
    return null;
  }

  let parsedReport: ComplianceAuditReport | undefined;
  if (snapshot.reportJson) {
    try {
      parsedReport = JSON.parse(snapshot.reportJson);
    } catch {
      // ignore JSON parse error
    }
  }

  return {
    id: snapshot.id,
    timestamp: snapshot.createdAt.toISOString(),
    overallScore: snapshot.overallScore,
    totalIssues: snapshot.totalIssues,
    criticalIssues: snapshot.criticalIssues,
    warningIssues: snapshot.warningIssues,
    passed: snapshot.criticalIssues === 0,
    report: parsedReport,
  };
}

/**
 * Get compliance check snapshot history.
 */
export async function getComplianceHistory(
  limit: number = 20
): Promise<ComplianceCheckResult[]> {
  const snapshots = await prisma.complianceSnapshot.findMany({
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 100),
  });

  return snapshots.map((snapshot) => ({
    id: snapshot.id,
    timestamp: snapshot.createdAt.toISOString(),
    overallScore: snapshot.overallScore,
    totalIssues: snapshot.totalIssues,
    criticalIssues: snapshot.criticalIssues,
    warningIssues: snapshot.warningIssues,
    passed: snapshot.criticalIssues === 0,
  }));
}

