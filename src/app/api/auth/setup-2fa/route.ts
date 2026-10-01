import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { getPending2FAUserId, getCurrentUser, setSessionCookie, clearPending2FACookie } from '@/lib/auth/session';
import { initiateTotpSetup, verifyTotpToken } from '@/lib/auth/totp';
import { logAuditEvent } from '@/lib/audit/logger';
import { Role } from '@/lib/auth/rbac';
import crypto from 'crypto';
import { encryptToken } from '@/lib/security/encryption';

// GET: Generate new TOTP setup data (QR code + secret + backup codes)
export async function GET() {
  try {
    let userId = await getPending2FAUserId();
    if (!userId) {
      const currentUser = await getCurrentUser();
      if (currentUser) {
        userId = currentUser.userId;
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized or session expired' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const setupData = await initiateTotpSetup(user.email);

    return NextResponse.json({
      secret: setupData.secret,
      otpauthUrl: setupData.otpauthUrl,
      qrCodeDataUrl: setupData.qrCodeDataUrl,
      backupCodes: setupData.backupCodes,
    });
  } catch (error) {
    console.error('TOTP setup error:', error);
    return NextResponse.json({ error: 'Failed to generate 2FA setup' }, { status: 500 });
  }
}

// POST: Confirm setup by verifying first TOTP code and saving to database
export async function POST(request: Request) {
  try {
    let userId = await getPending2FAUserId();
    if (!userId) {
      const currentUser = await getCurrentUser();
      if (currentUser) {
        userId = currentUser.userId;
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized or session expired' }, { status: 401 });
    }

    const body = await request.json();
    const { token, secret, backupCodes } = body;

    if (!token || !secret) {
      return NextResponse.json({ error: 'Token and secret are required' }, { status: 400 });
    }

    const isValid = verifyTotpToken(token, secret);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid authenticator code. Check clock sync and retry.' }, { status: 400 });
    }

    // Hash backup codes before saving
    let hashedBackupCodes: string[] = [];
    if (Array.isArray(backupCodes)) {
      hashedBackupCodes = backupCodes.map((code: string) =>
        crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex')
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
  } catch (error) {
    console.error('2FA verification error:', error);
    return NextResponse.json({ error: 'Failed to verify and activate 2FA' }, { status: 500 });
  }
}
