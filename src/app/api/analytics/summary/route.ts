import { NextResponse } from 'next/server';
import { generateAiAnalyticsSummary } from '@/lib/analytics/service';
import { withApi } from '@/lib/api/handler';

export const POST = withApi(
  async (req: Request) => {
    const body = await req.json().catch(() => ({}));
    const days = body.days ? parseInt(body.days, 10) : 7;

    const summary = await generateAiAnalyticsSummary(days);
    return NextResponse.json({ summary });
  },
  { permission: 'view_analytics' },
);
