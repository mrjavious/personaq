import { NextResponse } from 'next/server';
import { getComplianceHistory } from '@/lib/compliance/scheduler';
import { withApi } from '@/lib/api/handler';

export const GET = withApi(
  async (request: Request) => {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit')
      ? parseInt(searchParams.get('limit')!, 10)
      : 20;

    const history = await getComplianceHistory(limit);
    return NextResponse.json({ success: true, history });
  },
  { permission: 'review_safety_overrides' }
);
