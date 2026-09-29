import { NextResponse } from 'next/server';
import { checkComfyStatus } from '@/lib/comfyui/client';

export async function GET() {
  const status = await checkComfyStatus();
  return NextResponse.json(status);
}
