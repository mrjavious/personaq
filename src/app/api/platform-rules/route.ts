import { NextResponse } from 'next/server';
import { getAllPlatformRules, updatePlatformRule } from '@/lib/rules/service';
import { requireAuth } from '@/lib/auth/guards';

export async function GET() {
  try {
    await requireAuth();
    const rules = await getAllPlatformRules();
    return NextResponse.json({ rules });
  } catch (error) {
    console.error('Error fetching platform rules:', error);
    return NextResponse.json({ error: 'Failed to fetch platform rules' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { platform, rulesJson } = body;

    if (!platform || !rulesJson) {
      return NextResponse.json({ error: 'Platform and rulesJson are required' }, { status: 400 });
    }

    const updated = await updatePlatformRule(platform, rulesJson, user.userId);
    return NextResponse.json({ success: true, rule: updated });
  } catch (error) {
    console.error('Error updating platform rule:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update platform rule' },
      { status: 400 }
    );
  }
}
