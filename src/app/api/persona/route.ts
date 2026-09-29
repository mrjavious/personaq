import { NextResponse } from 'next/server';
import { getActivePersona, createPersona } from '@/lib/persona/service';
import { getCurrentUser } from '@/lib/auth/session';

export async function GET() {
  try {
    const persona = await getActivePersona();
    return NextResponse.json({ persona });
  } catch (error) {
    console.error('Error fetching persona:', error);
    return NextResponse.json({ error: 'Failed to fetch persona' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    const body = await request.json();

    const persona = await createPersona(body, user?.userId);
    return NextResponse.json({ success: true, persona });
  } catch (error) {
    console.error('Error creating persona:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create persona' },
      { status: 400 }
    );
  }
}
