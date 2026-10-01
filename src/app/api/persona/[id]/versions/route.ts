import { NextResponse } from 'next/server';
import { rollbackPersonaVersion } from '@/lib/persona/service';
import { requireAuth } from '@/lib/auth/guards';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await params; // consume params
    const user = await requireAuth();
    const body = await request.json();
    const { versionId } = body;

    if (!versionId) {
      return NextResponse.json({ error: 'versionId is required' }, { status: 400 });
    }

    const persona = await rollbackPersonaVersion(versionId, user.userId);
    return NextResponse.json({ success: true, persona });
  } catch (error) {
    console.error('Error rolling back persona version:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to rollback version' },
      { status: 400 }
    );
  }
}
