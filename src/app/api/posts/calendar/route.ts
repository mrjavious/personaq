import { NextResponse } from 'next/server';
import { getCalendarPosts } from '@/lib/composer/service';
import { withApi } from '@/lib/api/handler';

export const GET = withApi(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;

  const variants = await getCalendarPosts(startDate, endDate);
  return NextResponse.json({ variants });
});
