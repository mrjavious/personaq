import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { getPending2FAUserId, setSessionCookie, clearPending2FACookie } from '@/lib/auth/session';
import { verifyTotpToken, verifyAndConsumeBackupCode } from '@/lib/auth/totp';
import { logAuditEvent } from '@/lib/audit/logger';
import { Role } from '@/lib/auth/rbac';

export async function POST(request: Request) {
  try {
    const userId = await getPending2FAUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Session expired or not found. Please log in again.' }, { status: 401 });
    }

    const body = await request.json();
    const { token, isBackupCode } = body;

    if (!token) {
      return NextResponse.json({ error: 'Security code is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.totpSecret) {
      return NextResponse.json({ error: 'User 2FA is not configured properly.' }, { status: 400 });
    }

    let isValid = false;

    if (isBackupCode) {
      // Check backup code
      const currentHashedCodes: string[] = user.backupCodes ? JSON.parse(user.backupCodes) : [];
      const backupResult = verifyAndConsumeBackupCode(token, currentHashedCodes);

      if (backupResult.valid) {
        isValid = true;
        // Update remaining backup codes
        await prisma.user.update({
          where: { id: user.id },
          data: { backupCodes: JSON.stringify(backupResult.remainingHashedCodes) },
        });
      }
    } else {
      // Check standard 6-digit TOTP
      isValid = verifyTotpToken(token, user.totpSecret);
    }

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid authentication code. Please try again.' }, { status: 401 });
    }

    // Create active session cookie
    await setSessionCookie({
      userId: user.id,
      email: user.email,
      role: user.role as Role,
      twoFactorAuthenticated: true,
    });

    await clearPending2FACookie();

    await logAuditEvent({
      userId: user.id,
      action: '2fa_verify',
      entity: 'User',
      entityId: user.id,
      meta: { method: isBackupCode ? 'backup_code' : 'totp' },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        totpEnabled: true,
      },
    });
  } catch (error) {
    console.error('Verify 2FA error:', error);
    return NextResponse.json({ error: 'Internal server error during verification' }, { status: 500 });
  }
}
