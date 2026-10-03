import { NextResponse } from 'next/server';
import { verifyPlatformRule } from '@/lib/rules/service';
import { withApi } from '@/lib/api/handler';

export const POST = withApi<{ platform: string }>(
  async (_request, context) => {
    const params = await context.params;
    const platform = params?.platform || '';
    const updated = await verifyPlatformRule(platform, context.user.userId);
    return NextResponse.json({ success: true, rule: updated });
  },
  { permission: 'manage_platform_rules' }
);
