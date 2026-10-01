import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth/guards';
import { createLinkSchema } from '@/lib/validation/schemas';

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const [links, total] = await Promise.all([
      prisma.linkHub.findMany({
        include: {
          persona: {
            select: { id: true, name: true },
          },
          _count: {
            select: { clickEvents: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.linkHub.count(),
    ]);

    return NextResponse.json({ links, total, limit, offset });
  } catch (error) {
    console.error('Error fetching links:', error);
    return NextResponse.json({ error: 'Failed to fetch links' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = await req.json();

    const validation = createLinkSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.flatten() },
        { status: 400 },
      );
    }

    const { slug, destinationUrl, personaId, isNeutralLanding } = validation.data;

    // Clean slug
    const cleanSlug = slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-');

    // Get or default persona
    let targetPersonaId = personaId;
    if (!targetPersonaId) {
      const defaultPersona = await prisma.persona.findFirst();
      if (!defaultPersona) {
        return NextResponse.json({ error: 'No persona found to attach link' }, { status: 400 });
      }
      targetPersonaId = defaultPersona.id;
    }

    // Check slug uniqueness
    const existing = await prisma.linkHub.findUnique({
      where: { slug: cleanSlug },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Slug "${cleanSlug}" is already taken` },
        { status: 409 }
      );
    }

    const newLink = await prisma.linkHub.create({
      data: {
        slug: cleanSlug,
        destinationUrl: destinationUrl.trim(),
        personaId: targetPersonaId,
        isNeutralLanding: isNeutralLanding !== undefined ? isNeutralLanding : true,
      },
      include: {
        persona: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ link: newLink }, { status: 201 });
  } catch (error) {
    console.error('Error creating link hub:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create link' },
      { status: 500 }
    );
  }
}
