import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const EXACT_PUBLIC_PATHS = new Set([
  '/login',
  '/api/auth/login',
  '/api/auth/verify-2fa',
  '/api/health',
  '/api/links/click',
]);

function isPublicPath(pathname: string): boolean {
  if (EXACT_PUBLIC_PATHS.has(pathname)) {
    return true;
  }
  // Segment-boundary matching only: /l/<slug> and /public-media/avatar/<personaId>
  if (pathname.startsWith('/l/') || pathname.startsWith('/public-media/avatar/')) {
    return true;
  }
  return false;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Check for session cookie
  const token = request.cookies.get('personaq_session')?.value;
  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized', success: false }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET!);
    await jwtVerify(token, secret, {
      algorithms: ['HS256'],
      issuer: 'personaq',
      audience: 'personaq-app',
    });
    return NextResponse.next();
  } catch {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Invalid or expired session', success: false }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public/).*)'],
};
