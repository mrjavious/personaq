import { NextResponse } from 'next/server';
import { exportAnalyticsCsv } from '@/lib/analytics/service';

export async function GET() {
  try {
    const csvData = await exportAnalyticsCsv();

    return new NextResponse(csvData, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="personaq-analytics-${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    console.error('Error exporting analytics CSV:', error);
    return NextResponse.json({ error: 'Failed to export analytics' }, { status: 500 });
  }
}
