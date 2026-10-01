import { NextResponse } from 'next/server';
import { getActivePersona, getAllPersonas, getPersonaById, createPersona, deletePersona } from '@/lib/persona/service';
import { getCurrentUser } from '@/lib/auth/session';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    const persona = id ? await getPersonaById(id) : await getActivePersona();
    const allPersonas = await getAllPersonas();
    return NextResponse.json({ persona, allPersonas });
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

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let id = searchParams.get('id');
    if (!id) {
      try {
        const body = await request.json();
        id = body?.id;
      } catch {
        // ignore
      }
    }

    if (!id) {
      return NextResponse.json({ error: 'Persona ID is required' }, { status: 400 });
    }

    const user = await getCurrentUser();
    const result = await deletePersona(id, user?.userId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error deleting persona:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete persona' },
      { status: 400 }
    );
  }
}

