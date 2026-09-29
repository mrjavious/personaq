import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

export async function GET() {
  try {
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
