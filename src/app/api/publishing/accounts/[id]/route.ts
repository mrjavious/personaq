import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { encryptToken } from '@/lib/security/encryption';
import { logAuditEvent } from '@/lib/audit/logger';
import { updatePlatformAccountSchema } from '@/lib/validation/schemas';
import { withApi } from '@/lib/api/handler';

export const GET = withApi<{ id: string }>(async (_request, context) => {
  const params = await context.params;
  const id = params?.id || '';
  const account = await prisma.platformAccount.findUnique({
    where: { id },
    include: {
      persona: {
        select: { name: true, adultAge: true },
      },
    },
  });

  if (!account) {
    return NextResponse.json({ error: 'Account not found', success: false }, { status: 404 });
  }

  return NextResponse.json({
    account: {
      ...account,
      hasToken: Boolean(account.tokenEncrypted),
      tokenEncrypted: undefined,
    },
  });
});

export const PUT = withApi<{ id: string }>(
  async (request, context) => {
    const params = await context.params;
    const id = params?.id || '';
    const body = await request.json();
    const { rawToken, ...rest } = body;
    const validated = updatePlatformAccountSchema.parse(rest);

    const data: Record<string, unknown> = { ...validated };
    if (rawToken) {
      data.tokenEncrypted = encryptToken(rawToken);
    }
    data.lastVerifiedAt = new Date();

    const updated = await prisma.platformAccount.update({
      where: { id },
      data,
    });

    await logAuditEvent({
      userId: context.user.userId,
      action: 'settings_change',
      entity: 'PlatformRule',
      entityId: id,
      meta: {
        platform: updated.platform,
        handle: updated.handle,
        apiStatus: updated.apiStatus,
        tokenUpdated: Boolean(rawToken),
      },
    });

    return NextResponse.json({
      success: true,
      account: {
        ...updated,
        hasToken: Boolean(updated.tokenEncrypted),
        tokenEncrypted: undefined,
      },
    });
  },
  { permission: 'manage_persona' },
);

export const DELETE = withApi<{ id: string }>(
  async (_request, context) => {
    const params = await context.params;
    const id = params?.id || '';
    await prisma.platformAccount.delete({ where: { id } });

    await logAuditEvent({
      userId: context.user.userId,
      action: 'settings_change',
      entity: 'System',
      entityId: id,
      meta: { target: 'PlatformAccount', action: 'deleted' },
    });

    return NextResponse.json({ success: true, message: 'Platform account deleted' });
  },
  { permission: 'manage_persona' },
);
