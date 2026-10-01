import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { encryptToken } from '@/lib/security/encryption';
import { requireAuth } from '@/lib/auth/guards';
import { logAuditEvent } from '@/lib/audit/logger';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireAuth();
    const body = await request.json();
    const { handle, apiStatus, rawToken, disclosureInBio } = body;

    const data: Record<string, unknown> = {};
    if (handle !== undefined) data.handle = handle;
    if (apiStatus !== undefined) data.apiStatus = apiStatus;
    if (disclosureInBio !== undefined) data.disclosureInBio = disclosureInBio;
    if (rawToken) {
      data.tokenEncrypted = encryptToken(rawToken);
    }
    data.lastVerifiedAt = new Date();

    const updated = await prisma.platformAccount.update({
      where: { id },
      data,
    });

    await logAuditEvent({
      userId: user.userId,
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
  } catch (error) {
    console.error('Error updating platform account:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Update failed' },
      { status: 400 }
    );
  }
}
