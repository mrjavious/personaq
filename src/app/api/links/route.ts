import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const links = await prisma.linkHub.findMany({
      include: {
        persona: {
          select: { id: true, name: true },
        },
        _count: {
          select: { clickEvents: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ links });
  } catch (error) {
    console.error('Error fetching links:', error);
    return NextResponse.json({ error: 'Failed to fetch links' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, destinationUrl, personaId, isNeutralLanding } = body;

    if (!slug || !destinationUrl) {
      return NextResponse.json(
        { error: 'Slug and destination URL are required' },
        { status: 400 }
      );
    }

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
