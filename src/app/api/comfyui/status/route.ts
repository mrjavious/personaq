import { NextResponse } from 'next/server';
import { checkComfyStatus } from '@/lib/comfyui/client';
import { requireAuth } from '@/lib/auth/guards';

export async function GET() {
  await requireAuth();
  const status = await checkComfyStatus();
  return NextResponse.json(status);
}
