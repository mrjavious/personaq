import { NextResponse } from 'next/server';
import { runScheduledComplianceCheck, getLatestComplianceCheck } from '@/lib/compliance/scheduler';
import { withApi } from '@/lib/api/handler';

export const POST = withApi(
  async () => {
    const result = await runScheduledComplianceCheck();
    return NextResponse.json({ success: true, result });
  },
  { permission: 'review_safety_overrides' }
);

export const GET = withApi(
  async () => {
    const latest = await getLatestComplianceCheck();
    return NextResponse.json({ success: true, latest });
  },
  { permission: 'review_safety_overrides' }
);
