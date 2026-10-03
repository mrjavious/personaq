import { NextResponse } from 'next/server';
import { getActivePersona, getAllPersonas, getPersonaById, createPersona, deletePersona } from '@/lib/persona/service';
import { createPersonaSchema } from '@/lib/validation/schemas';
import { withApi } from '@/lib/api/handler';

export const GET = withApi(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  const persona = id ? await getPersonaById(id) : await getActivePersona();
  const { personas: allPersonas, total } = await getAllPersonas(limit, offset);
  return NextResponse.json({ persona, allPersonas, total, limit, offset });
});

export const POST = withApi(
  async (request: Request, context) => {
    const body = await request.json();
    const data = createPersonaSchema.parse(body);
    const persona = await createPersona(data, context.user.userId);
    return NextResponse.json({ success: true, persona });
  },
  { permission: 'manage_persona' },
);

export const DELETE = withApi(
  async (request: Request, context) => {
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
      return NextResponse.json({ error: 'Persona ID is required', success: false }, { status: 400 });
    }

    const result = await deletePersona(id, context.user.userId);
    return NextResponse.json(result);
  },
  { permission: 'manage_persona' },
);
