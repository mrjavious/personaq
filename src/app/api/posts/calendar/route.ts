import { NextResponse } from 'next/server';
import { getCalendarPosts } from '@/lib/composer/service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const variants = await getCalendarPosts(startDate, endDate);
    return NextResponse.json({ variants });
  } catch (error) {
    console.error('Error fetching calendar posts:', error);
    return NextResponse.json({ error: 'Failed to fetch calendar posts' }, { status: 500 });
  }
}
