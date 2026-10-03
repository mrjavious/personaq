import { NextResponse } from 'next/server';
import { exportAnalyticsCsv } from '@/lib/analytics/service';
import { withApi } from '@/lib/api/handler';

export const GET = withApi(
  async () => {
    const csvData = await exportAnalyticsCsv();

    return new NextResponse(csvData, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="personaq-analytics-${Date.now()}.csv"`,
      },
    });
  },
  { permission: 'view_analytics' },
);
