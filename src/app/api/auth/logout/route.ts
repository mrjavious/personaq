import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth/session';
import { withApi } from '@/lib/api/handler';

export const POST = withApi(
  async () => {
    await clearSessionCookie();
    return NextResponse.json({ success: true, message: 'Logged out successfully' });
  },
  { public: true },
);
