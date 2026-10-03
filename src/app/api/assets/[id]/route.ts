import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import storage from '@/lib/storage';
import { logAuditEvent } from '@/lib/audit/logger';
import { withApi } from '@/lib/api/handler';

export const GET = withApi<{ id: string }>(async (_request, context) => {
  const params = await context.params;
  const id = params?.id || '';
  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset) {
    return NextResponse.json({ error: 'Asset not found', success: false }, { status: 404 });
  }
  return NextResponse.json({ asset });
});

export const DELETE = withApi<{ id: string }>(
  async (_request, context) => {
    const params = await context.params;
    const id = params?.id || '';
    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      return NextResponse.json({ error: 'Asset not found', success: false }, { status: 404 });
    }

    // Delete from storage
    if (asset.storageKey) {
      try {
        await storage.delete(asset.storageKey);
      } catch (err) {
        console.warn('Storage delete error:', err);
      }
    }

    // Delete from DB
    await prisma.asset.delete({ where: { id } });

    await logAuditEvent({
      userId: context.user.userId,
      action: 'settings_change',
      entity: 'Asset',
      entityId: id,
      meta: { action: 'deleted' },
    });

    return NextResponse.json({ success: true, message: 'Asset deleted' });
  },
  { permission: 'manage_persona' },
);
