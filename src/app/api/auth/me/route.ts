import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { withApi } from '@/lib/api/handler';

export const GET = withApi(async (_request, context) => {
  const user = await prisma.user.findUnique({
    where: { id: context.user.userId },
    select: {
      id: true,
      email: true,
      role: true,
      totpEnabled: true,
      createdAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ authenticated: false, user: null, success: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      ...user,
      twoFactorAuthenticated: context.user.twoFactorAuthenticated,
    },
  });
});
