import { NextResponse } from 'next/server';
import { metrics } from '@/lib/metrics';
import { withApi } from '@/lib/api/handler';

export const GET = withApi(
  async () => {
    const allMetrics = metrics.getMetrics();
    return NextResponse.json(allMetrics);
  },
  { permission: 'view_analytics' },
);
