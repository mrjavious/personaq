import { NextRequest, NextResponse } from 'next/server';
import { importAnalyticsCsv } from '@/lib/analytics/service';
import { requireAuth } from '@/lib/auth/guards';

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const contentType = req.headers.get('content-type') || '';
    let csvContent = '';

    if (contentType.includes('application/json')) {
      const body = await req.json();
      csvContent = body.csvContent;
    } else {
      csvContent = await req.text();
    }

    if (!csvContent || !csvContent.trim()) {
      return NextResponse.json({ error: 'CSV content cannot be empty' }, { status: 400 });
    }

    const result = await importAnalyticsCsv(csvContent);
    return NextResponse.json({
      success: true,
      importedCount: result.importedCount,
      message: `Successfully imported ${result.importedCount} snapshot records.`,
    });
  } catch (error) {
    console.error('Error importing analytics CSV:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import CSV' },
      { status: 500 }
    );
  }
}
