import { NextResponse } from 'next/server';
import { importAnalyticsCsv } from '@/lib/analytics/service';
import { withApi } from '@/lib/api/handler';

export const POST = withApi(
  async (req: Request) => {
    const contentType = req.headers.get('content-type') || '';
    let csvContent = '';

    if (contentType.includes('application/json')) {
      const body = await req.json();
      csvContent = body.csvContent || body.csvData;
    } else {
      csvContent = await req.text();
    }

    if (!csvContent || !csvContent.trim()) {
      return NextResponse.json({ error: 'CSV content cannot be empty', success: false }, { status: 400 });
    }

    const result = await importAnalyticsCsv(csvContent);
    return NextResponse.json({
      success: true,
      importedCount: result.importedCount,
      message: `Successfully imported ${result.importedCount} snapshot records.`,
    });
  },
  { permission: 'view_analytics' },
);
