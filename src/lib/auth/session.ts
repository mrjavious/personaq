import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { Role } from './rbac';

export interface SessionPayload {
  userId: string;
  email: string;
  role: Role;
  twoFactorAuthenticated: boolean;
}

const COOKIE_NAME = 'personaq_session';
const PENDING_2FA_COOKIE_NAME = 'personaq_pending_2fa';
const DEFAULT_SECRET = 'personaq_local_dev_secret_key_32_chars_long_minimum';

function getJwtSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: AUTH_SECRET environment variable is required in production.');
    }
    return new TextEncoder().encode(DEFAULT_SECRET.padEnd(32, '0'));
  }
  return new TextEncoder().encode(secret.padEnd(32, '0'));
}

export async function signSession(payload: SessionPayload, expiresIn: string = '7d'): Promise<string> {
  const secret = getJwtSecret();
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      role: payload.role as Role,
      twoFactorAuthenticated: Boolean(payload.twoFactorAuthenticated),
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await signSession(payload, '7d');
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
}

export async function setPending2FACookie(userId: string): Promise<void> {
  const secret = getJwtSecret();
  const token = await new SignJWT({ userId, pending2FA: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('10m') // 10 minutes to complete 2FA
    .sign(secret);

  const cookieStore = await cookies();
  cookieStore.set(PENDING_2FA_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60,
  });
}

export async function getPending2FAUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(PENDING_2FA_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);
    if (payload.pending2FA && typeof payload.userId === 'string') {
      return payload.userId;
    }
    return null;
  } catch {
    return null;
  }
}

export async function clearPending2FACookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(PENDING_2FA_COOKIE_NAME);
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  cookieStore.delete(PENDING_2FA_COOKIE_NAME);
}

export async function getCurrentUser(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await verifySession(token);
  if (!session) return null;

  // Strict 2FA check when AUTH_REQUIRE_2FA is true
  const require2FA = process.env.AUTH_REQUIRE_2FA !== 'false';
  if (require2FA && !session.twoFactorAuthenticated) {
    return null;
  }

  return session;
}
