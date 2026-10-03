import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withApi } from '@/lib/api/handler';

export const GET = withApi(
  async (req) => {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'json';
    const linkId = searchParams.get('linkId');

    const whereClause: Record<string, unknown> = {};
    if (linkId) {
      whereClause.linkId = linkId;
    }

    const clicks = await prisma.clickEvent.findMany({
      where: whereClause,
      include: {
        link: {
          select: { slug: true, destinationUrl: true },
        },
      },
      orderBy: { ts: 'desc' },
      take: 1000,
    });

    if (format === 'csv') {
      const headers = ['id', 'slug', 'utm_source', 'utm_campaign', 'utm_content', 'referrer', 'timestamp'];
      const rows = clicks.map((c) => [
        c.id,
        c.link.slug,
        c.utmSource || '',
        c.utmCampaign || '',
        c.utmContent || '',
        c.referrer || '',
        c.ts.toISOString(),
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.map((val) => `"${val.replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="personaq-click-events-${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json({ clicks });
  },
  { permission: 'view_analytics' }
);
