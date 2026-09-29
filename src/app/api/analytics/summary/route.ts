import { NextRequest, NextResponse } from 'next/server';
import { generateAiAnalyticsSummary } from '@/lib/analytics/service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const days = body.days ? parseInt(body.days, 10) : 7;

    const summary = await generateAiAnalyticsSummary(days);
    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Error generating AI analytics summary:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate AI summary' },
      { status: 500 }
    );
  }
}
