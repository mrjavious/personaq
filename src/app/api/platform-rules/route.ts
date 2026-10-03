import { NextResponse } from 'next/server';
import { getAllPlatformRules, updatePlatformRule } from '@/lib/rules/service';
import { withApi } from '@/lib/api/handler';
import { updatePlatformRuleSchema } from '@/lib/validation/schemas';

export const GET = withApi(async () => {
  const rules = await getAllPlatformRules();
  return NextResponse.json({ rules });
});

export const PUT = withApi(
  async (request, context) => {
    const body = await request.json();
    const parsed = updatePlatformRuleSchema.parse(body);

    const updated = await updatePlatformRule(parsed.platform, parsed.rulesJson, context.user.userId);
    return NextResponse.json({ success: true, rule: updated });
  },
  { permission: 'manage_platform_rules' }
);
