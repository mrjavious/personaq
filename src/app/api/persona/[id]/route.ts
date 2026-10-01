import { NextResponse } from 'next/server';
import { getPersonaById, updatePersona, deletePersona } from '@/lib/persona/service';
import { requireAuth } from '@/lib/auth/guards';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
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
    const user = await requireAuth();
    const body = await request.json();
    const { changeSummary, ...input } = body;

    const persona = await updatePersona(id, input, user.userId, changeSummary);
    return NextResponse.json({ success: true, persona });
  } catch (error) {
    console.error('Error updating persona:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update persona' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

