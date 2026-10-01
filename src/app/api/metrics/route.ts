import { NextResponse } from 'next/server';
import { metrics } from '@/lib/metrics';
import { requireAuth } from '@/lib/auth/guards';

export async function GET() {
  try {
    await requireAuth();
    const allMetrics = metrics.getMetrics();
    return NextResponse.json(allMetrics);
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
  }
}
