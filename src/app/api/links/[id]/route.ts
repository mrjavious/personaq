import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    return NextResponse.json({ link });
  } catch (error) {
    console.error('Error fetching link details:', error);
    return NextResponse.json({ error: 'Failed to fetch link' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { slug, destinationUrl, isNeutralLanding } = body;

    const dataToUpdate: Record<string, unknown> = {};
    if (slug) {
      dataToUpdate.slug = slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    }
    if (destinationUrl) {
      dataToUpdate.destinationUrl = destinationUrl.trim();
    }
    if (isNeutralLanding !== undefined) {
      dataToUpdate.isNeutralLanding = Boolean(isNeutralLanding);
    }

    const updated = await prisma.linkHub.update({
      where: { id },
      data: dataToUpdate,
    });

    return NextResponse.json({ link: updated });
  } catch (error) {
    console.error('Error updating link:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update link' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.linkHub.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting link:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete link' },
      { status: 500 }
    );
  }
}
