import { NextResponse } from 'next/server';
import { rollbackPersonaVersion } from '@/lib/persona/service';
import { withApi } from '@/lib/api/handler';

export const POST = withApi<{ id: string }>(
  async (request, context) => {
    const body = await request.json();
    const { versionId } = body;

    if (!versionId || typeof versionId !== 'string') {
      return NextResponse.json({ error: 'versionId is required', success: false }, { status: 400 });
    }

    const persona = await rollbackPersonaVersion(versionId, context.user.userId);
    return NextResponse.json({ success: true, persona });
  },
  { permission: 'manage_persona' },
);
