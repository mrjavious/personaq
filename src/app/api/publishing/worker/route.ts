import { NextResponse } from 'next/server';
import { runSchedulerWorkerTick } from '@/lib/publishing/worker';
import { requireAuth } from '@/lib/auth/guards';

export async function POST() {
  try {
    await requireAuth();
    const result = await runSchedulerWorkerTick();
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Queue worker tick error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Worker execution failed' },
      { status: 500 }
    );
  }
}
