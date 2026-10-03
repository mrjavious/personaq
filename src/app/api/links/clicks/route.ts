import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withApi } from '@/lib/api/handler';

export const DELETE = withApi(
  async (req) => {
    const { searchParams } = new URL(req.url);
    const linkId = searchParams.get('linkId');

    const whereClause: Record<string, unknown> = {};
    if (linkId) {
      whereClause.linkId = linkId;
    }

    const result = await prisma.clickEvent.deleteMany({
      where: whereClause,
    });

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
      message: `Successfully purged ${result.count} click records.`,
    });
  },
  { permission: 'view_analytics' }
);
