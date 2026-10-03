import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withApi } from '@/lib/api/handler';
import { updateLinkSchema } from '@/lib/validation/schemas';
import { getAggregatedClickMetrics } from '@/lib/links/utm';

export const GET = withApi<{ id: string }>(async (_req, context) => {
  const params = await context.params;
  const id = params?.id || '';
  const link = await prisma.linkHub.findUnique({
    where: { id },
    include: {
      persona: { select: { id: true, name: true } },
      clickEvents: {
        orderBy: { ts: 'desc' },
        take: 50,
      },
      _count: {
        select: { clickEvents: true },
      },
    },
  });

  if (!link) {
    return NextResponse.json({ error: 'Link not found', success: false }, { status: 404 });
  }

  const metrics = await getAggregatedClickMetrics(link.id);

  return NextResponse.json({ link, metrics });
});

export const PUT = withApi<{ id: string }>(
  async (req, context) => {
    const params = await context.params;
    const id = params?.id || '';
    const body = await req.json();
    const { slug, destinationUrl, personaId, isNeutralLanding } = updateLinkSchema.parse(body);

    const dataToUpdate: Record<string, unknown> = {};
    if (slug) {
      dataToUpdate.slug = slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    }
    if (destinationUrl) {
      dataToUpdate.destinationUrl = destinationUrl.trim();
    }
    if (personaId) {
      dataToUpdate.personaId = personaId;
    }
    if (isNeutralLanding !== undefined) {
      dataToUpdate.isNeutralLanding = Boolean(isNeutralLanding);
    }

    const updated = await prisma.linkHub.update({
      where: { id },
      data: dataToUpdate,
    });

    return NextResponse.json({ link: updated });
  },
  { permission: 'manage_persona' }
);

export const DELETE = withApi<{ id: string }>(
  async (_req, context) => {
    const params = await context.params;
    const id = params?.id || '';
    await prisma.linkHub.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  },
  { permission: 'manage_persona' }
);
