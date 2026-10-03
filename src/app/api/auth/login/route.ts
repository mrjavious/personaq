import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import bcrypt from 'bcryptjs';
import { setSessionCookie, setPending2FACookie } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { Role } from '@/lib/auth/rbac';
import { checkLoginRateLimit, recordLoginAttempt } from '@/lib/security/rate-limit';
import { loginSchema } from '@/lib/validation/schemas';
import { withApi } from '@/lib/api/handler';

// Compute a valid 60-character bcrypt hash at module load so comparing against a non-existent
// user costs the exact same CPU cycles as comparing against an existing user hash.
export const DUMMY_HASH = bcrypt.hashSync('dummy_timing_salt_password', 10);

export const POST = withApi(
  async (request: Request) => {
    const rateLimit = checkLoginRateLimit(request);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Too many login attempts. Please try again later.',
          retryAfter: rateLimit.retryAfter,
          success: false,
        },
        { status: 429 },
      );
    }

    const body = await request.json();
    const { email, password } = loginSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      // Perform dummy bcrypt comparison to prevent timing attacks
      await bcrypt.compare(password, DUMMY_HASH);
      recordLoginAttempt(request, false);
      return NextResponse.json({ error: 'Invalid credentials', success: false }, { status: 401 });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      recordLoginAttempt(request, false);
      return NextResponse.json({ error: 'Invalid credentials', success: false }, { status: 401 });
    }

    recordLoginAttempt(request, true);

    // Check 2FA requirement
    const require2FA = process.env.AUTH_REQUIRE_2FA !== 'false';

    if (user.totpEnabled && user.totpSecret) {
      // User has 2FA enabled: require 2FA verification step
      await setPending2FACookie(user.id);
      return NextResponse.json({
        success: true,
        require2FA: true,
        message: 'Two-Factor Authentication token required',
      });
    }

    if (require2FA && !user.totpEnabled) {
      // 2FA is required by system guardrails: prompt setup
      await setPending2FACookie(user.id);
      return NextResponse.json({
        success: true,
        requireSetup2FA: true,
        message: '2FA enrollment required for this account',
      });
    }

    // Direct login allowed only if 2FA is disabled globally (e.g. unit testing)
    await setSessionCookie({
      userId: user.id,
      email: user.email,
      role: user.role as Role,
      twoFactorAuthenticated: false,
    });

    await logAuditEvent({
      userId: user.id,
      action: 'login',
      entity: 'User',
      entityId: user.id,
      meta: { method: 'password' },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        totpEnabled: user.totpEnabled,
      },
    });
  },
  { public: true },
);
