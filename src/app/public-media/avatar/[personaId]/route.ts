import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import prisma from '@/lib/db/prisma';

export async function GET(
  _request: Request,
  context: { params: Promise<{ personaId: string }> | { personaId: string } },
) {
  try {
    const { personaId } = await context.params;
    if (!personaId) {
      return NextResponse.json({ error: 'Missing personaId' }, { status: 400 });
    }

    // Verify persona exists and has a public link hub
    const linkHub = await prisma.linkHub.findFirst({
      where: {
        personaId,
        deletedAt: null,
      },
      include: {
        persona: true,
      },
    });

    if (!linkHub || !linkHub.persona || !linkHub.persona.avatarUrl) {
      return NextResponse.json({ error: 'Avatar not found or not public' }, { status: 404 });
    }

    const { avatarUrl } = linkHub.persona;

    // If external URL (e.g. S3/CDN), redirect
    if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
      return NextResponse.redirect(avatarUrl);
    }

    // Local file delivery with path traversal prevention
    const publicRoot = path.join(process.cwd(), 'public');
    const relativePath = avatarUrl.startsWith('/') ? avatarUrl.slice(1) : avatarUrl;
    const resolvedPath = path.resolve(publicRoot, relativePath);

    // Strictly ensure target is within public/uploads
    const allowedRoot = path.join(publicRoot, 'uploads');
    if (!resolvedPath.startsWith(allowedRoot)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!fs.existsSync(resolvedPath)) {
      return NextResponse.json({ error: 'Avatar file not found' }, { status: 404 });
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    const fileBuffer = fs.readFileSync(resolvedPath);
    return new Response(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('Public avatar serving error:', error);
    return NextResponse.json({ error: 'Failed to serve avatar' }, { status: 500 });
  }
}
