import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function DELETE(req: NextRequest) {
  try {
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
  } catch (error) {
    console.error('Error purging clicks:', error);
    return NextResponse.json({ error: 'Failed to purge click events' }, { status: 500 });
  }
}
