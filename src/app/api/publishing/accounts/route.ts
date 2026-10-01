import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/guards';

export async function GET() {
  try {
    await requireAuth();
    const accounts = await prisma.platformAccount.findMany({
      include: {
        persona: {
          select: { name: true, adultAge: true },
        },
      },
      orderBy: { platform: 'asc' },
    });

    // Mask sensitive token data
    const safeAccounts = accounts.map((acc) => ({
      ...acc,
      hasToken: Boolean(acc.tokenEncrypted),
      tokenEncrypted: undefined,
    }));

    return NextResponse.json({ accounts: safeAccounts });
  } catch (error) {
    console.error('Error fetching platform accounts:', error);
    return NextResponse.json({ error: 'Failed to fetch platform accounts' }, { status: 500 });
  }
}
