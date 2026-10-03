import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { createPlatformAccountSchema } from '@/lib/validation/schemas';
import { withApi } from '@/lib/api/handler';

export const GET = withApi(async () => {
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
});

export const POST = withApi(
  async (request: Request) => {
    const body = await request.json();
    const data = createPlatformAccountSchema.parse(body);

    const account = await prisma.platformAccount.create({
      data: {
        personaId: data.personaId,
        platform: data.platform,
        handle: data.handle,
        disclosureInBio: data.disclosureInBio,
        apiStatus: 'active',
      },
    });

    return NextResponse.json({ success: true, account });
  },
  { permission: 'manage_persona' },
);
