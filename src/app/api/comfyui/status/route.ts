import { NextResponse } from 'next/server';
import { checkComfyStatus } from '@/lib/comfyui/client';
import { withApi } from '@/lib/api/handler';

export const GET = withApi(async () => {
  const status = await checkComfyStatus();
  return NextResponse.json(status);
});
