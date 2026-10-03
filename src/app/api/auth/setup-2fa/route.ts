import { NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/db/prisma';
import { getPending2FAUserId, getCurrentUser, setSessionCookie, clearPending2FACookie } from '@/lib/auth/session';
import { initiateTotpSetup, verifyTotpToken } from '@/lib/auth/totp';
import { logAuditEvent } from '@/lib/audit/logger';
import { Role } from '@/lib/auth/rbac';
import { encryptToken } from '@/lib/security/encryption';
import { setup2FASchema } from '@/lib/validation/schemas';
import { withApi } from '@/lib/api/handler';

// GET: Generate new TOTP setup data (QR code + secret + backup codes)
export const GET = withApi(
  async () => {
    let userId = await getPending2FAUserId();
    if (!userId) {
      const currentUser = await getCurrentUser();
      if (currentUser) {
        userId = currentUser.userId;
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized or session expired', success: false }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found', success: false }, { status: 404 });
    }

    const setupData = await initiateTotpSetup(user.email);

    return NextResponse.json({
      secret: setupData.secret,
      otpauthUrl: setupData.otpauthUrl,
      qrCodeDataUrl: setupData.qrCodeDataUrl,
      backupCodes: setupData.backupCodes,
    });
  },
  { public: true },
);

// POST: Confirm setup by verifying first TOTP code and saving to database
export const POST = withApi(
  async (request: Request) => {
    let userId = await getPending2FAUserId();
    if (!userId) {
      const currentUser = await getCurrentUser();
      if (currentUser) {
        userId = currentUser.userId;
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized or session expired', success: false }, { status: 401 });
    }

    const body = await request.json();
    const { token, secret, backupCodes } = setup2FASchema.parse(body);

    const isValid = verifyTotpToken(token, secret);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid authenticator code. Check clock sync and retry.', success: false },
        { status: 400 },
      );
    }

    // Hash backup codes before saving
    let hashedBackupCodes: string[] = [];
    if (Array.isArray(backupCodes)) {
      hashedBackupCodes = backupCodes.map((code: string) =>
        crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex'),
      );
    }

    // Save to user (encrypt TOTP secret at rest)
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        totpSecret: encryptToken(secret),
        totpEnabled: true,
        backupCodes: JSON.stringify(hashedBackupCodes),
      },
    });

    // Establish full session
    await setSessionCookie({
      userId: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role as Role,
      twoFactorAuthenticated: true,
    });

    await clearPending2FACookie();

    await logAuditEvent({
      userId: updatedUser.id,
      action: '2fa_verify',
      entity: 'User',
      entityId: updatedUser.id,
      meta: { event: '2FA successfully enrolled and verified' },
    });

    return NextResponse.json({
      success: true,
      message: 'Two-factor authentication successfully enabled',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role,
        totpEnabled: true,
      },
    });
  },
  { public: true },
);
