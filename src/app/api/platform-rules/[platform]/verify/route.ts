import { NextResponse } from 'next/server';
import { verifyPlatformRule } from '@/lib/rules/service';
import { getCurrentUser } from '@/lib/auth/session';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const { platform } = await params;
    const user = await getCurrentUser();

    const updated = await verifyPlatformRule(platform, user?.userId);
    return NextResponse.json({ success: true, rule: updated });
  } catch (error) {
    console.error('Error verifying platform rule:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to verify platform rule' },
      { status: 400 }
    );
  }
}
