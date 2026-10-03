import { NextResponse } from 'next/server';
import { getAuditLogs } from '@/lib/audit/service';
import { withApi } from '@/lib/api/handler';

export const GET = withApi(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || undefined;
  const entity = searchParams.get('entity') || undefined;
  const format = searchParams.get('format') || 'json';
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;
  const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : 0;

  const result = await getAuditLogs({ action, entity, limit: format === 'csv' ? 1000 : limit, offset });

  // CSV export
  if (format === 'csv') {
    const headers = ['id', 'userId', 'action', 'entity', 'entityId', 'meta', 'timestamp'];
    const rows = result.logs.map((log) => [
      log.id,
      log.userId || '',
      log.action,
      log.entity,
      log.entityId,
      log.meta || '',
      log.ts.toISOString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="personaq-audit-logs-${Date.now()}.csv"`,
      },
    });
  }

  return NextResponse.json(result);
});
