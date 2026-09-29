import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const suitability = searchParams.get('suitability');
    const safetyStatus = searchParams.get('safetyStatus');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : 0;

    const where: Record<string, unknown> = {};
    if (suitability && suitability !== 'all') where.suitability = suitability;
    if (safetyStatus && safetyStatus !== 'all') where.safetyStatus = safetyStatus;

    const [assets, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.asset.count({ where }),
    ]);

    return NextResponse.json({ assets, total, limit, offset });
  } catch (error) {
    console.error('Error fetching assets:', error);
    return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 });
  }
}
