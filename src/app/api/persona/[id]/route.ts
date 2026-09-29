import { NextResponse } from 'next/server';
import { getPersonaById, updatePersona } from '@/lib/persona/service';
import { getCurrentUser } from '@/lib/auth/session';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const persona = await getPersonaById(id);
    if (!persona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
    }
    return NextResponse.json({ persona });
  } catch (error) {
    console.error('Error fetching persona:', error);
    return NextResponse.json({ error: 'Failed to fetch persona' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    const body = await request.json();
    const { changeSummary, ...input } = body;

    const persona = await updatePersona(id, input, user?.userId, changeSummary);
    return NextResponse.json({ success: true, persona });
  } catch (error) {
    console.error('Error updating persona:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update persona' },
      { status: 400 }
    );
  }
}
