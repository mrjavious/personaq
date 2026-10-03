import { NextResponse } from 'next/server';
import { getAggregatedAnalytics } from '@/lib/analytics/service';
import { withApi } from '@/lib/api/handler';

export const GET = withApi(
  async (req: Request) => {
    const { searchParams } = new URL(req.url);
    const daysParam = searchParams.get('days');
    const days = daysParam ? parseInt(daysParam, 10) : 30;

    const analytics = await getAggregatedAnalytics(days);
    return NextResponse.json({ analytics });
  },
  { permission: 'view_analytics' },
);
