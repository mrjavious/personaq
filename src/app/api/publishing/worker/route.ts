import { NextResponse } from 'next/server';
import { runSchedulerWorkerTick } from '@/lib/publishing/worker';
import { withApi } from '@/lib/api/handler';

export const POST = withApi(
  async () => {
    const result = await runSchedulerWorkerTick();
    return NextResponse.json({ success: true, result });
  },
  { permission: 'schedule_posts' },
);
