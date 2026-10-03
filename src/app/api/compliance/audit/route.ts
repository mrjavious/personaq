import { NextResponse } from 'next/server';
import { getComplianceAuditReport } from '@/lib/compliance/service';
import { withApi } from '@/lib/api/handler';

export const GET = withApi(
  async () => {
    const report = await getComplianceAuditReport();
    return NextResponse.json({ report });
  },
  { permission: 'review_safety_overrides' },
);
