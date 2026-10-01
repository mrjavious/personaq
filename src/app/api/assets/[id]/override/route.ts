import { NextResponse } from 'next/server';
import { overrideSafetyDecision } from '@/lib/safety/pipeline';
import { requireAuth } from '@/lib/auth/guards';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireAuth();
    const body = await request.json();
    const { reason } = body;

    if (!reason || typeof reason !== 'string') {
      return NextResponse.json({ error: 'Detailed justification reason is required for manual override' }, { status: 400 });
    }

    const updatedAsset = await overrideSafetyDecision(id, user.userId, reason);
    return NextResponse.json({ success: true, asset: updatedAsset });
  } catch (error) {
    console.error('Safety override error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Override failed' },
      { status: 400 }
    );
  }
}
