import { NextResponse } from 'next/server';
import { getActivePersona, getAllPersonas, getPersonaById, createPersona, deletePersona } from '@/lib/persona/service';
import { requireAuth } from '@/lib/auth/guards';
import { createPersonaSchema } from '@/lib/validation/schemas';

export async function GET(request: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const persona = id ? await getPersonaById(id) : await getActivePersona();
    const { personas: allPersonas, total } = await getAllPersonas(limit, offset);
    return NextResponse.json({ persona, allPersonas, total, limit, offset });
  } catch (error) {
    console.error('Error fetching persona:', error);
    return NextResponse.json({ error: 'Failed to fetch persona' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    const validation = createPersonaSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.flatten() },
        { status: 400 },
      );
    }

    const persona = await createPersona(validation.data, user.userId);
    return NextResponse.json({ success: true, persona });
  } catch (error) {
    console.error('Error creating persona:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create persona' },
      { status: 400 },
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

    const user = await requireAuth();
    const result = await deletePersona(id, user.userId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error deleting persona:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete persona' },
      { status: 400 }
    );
  }
}

