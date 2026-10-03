import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import storage from '@/lib/storage';
import { logAuditEvent } from '@/lib/audit/logger';
import { withApi } from '@/lib/api/handler';

export const GET = withApi(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const personaId = searchParams.get('personaId');
  const suitability = searchParams.get('suitability');
  const safetyStatus = searchParams.get('safetyStatus');
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;
  const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : 0;

  const where: Record<string, unknown> = {};
  if (personaId && personaId !== 'all') where.personaId = personaId;
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
});

export const DELETE = withApi(
  async (request: Request, context) => {
    const body = await request.json();
    const ids: string[] = Array.isArray(body.ids) ? body.ids : body.id ? [body.id] : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: 'No asset IDs provided', success: false }, { status: 400 });
    }

    const assets = await prisma.asset.findMany({
      where: { id: { in: ids } },
      select: { id: true, storageKey: true },
    });

    for (const asset of assets) {
      if (asset.storageKey) {
        try {
          await storage.delete(asset.storageKey);
        } catch (err) {
          console.warn('Failed to delete storage asset:', asset.storageKey, err);
        }
      }
    }

    const deleted = await prisma.asset.deleteMany({
      where: { id: { in: ids } },
    });

    await logAuditEvent({
      userId: context.user.userId,
      action: 'settings_change',
      entity: 'Asset',
      entityId: ids.join(','),
      meta: { action: 'bulk_deleted', count: deleted.count },
    });

    return NextResponse.json({ success: true, count: deleted.count });
  },
  { permission: 'manage_persona' },
);
