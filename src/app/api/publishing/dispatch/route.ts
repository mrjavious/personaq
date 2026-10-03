import { NextResponse } from 'next/server';
import { publishVariant } from '@/lib/publishing';
import { dispatchPublishingSchema } from '@/lib/validation/schemas';
import { withApi } from '@/lib/api/handler';

export const POST = withApi(
  async (request: Request, context) => {
    const body = await request.json();
    const { variantId, postVariantId } = dispatchPublishingSchema.parse(body);
    const targetVariantId = variantId || postVariantId;

    if (!targetVariantId) {
      return NextResponse.json({ error: 'variantId is required', success: false }, { status: 400 });
    }

    const result = await publishVariant(targetVariantId, context.user.userId);
    return NextResponse.json({ success: true, result });
  },
  { permission: 'schedule_posts' },
);
