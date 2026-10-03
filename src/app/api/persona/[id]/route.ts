import { NextResponse } from 'next/server';
import { getPersonaById, updatePersona, deletePersona } from '@/lib/persona/service';
import { updatePersonaSchema } from '@/lib/validation/schemas';
import { withApi } from '@/lib/api/handler';

export const GET = withApi<{ id: string }>(async (_request, context) => {
  const params = await context.params;
  const id = params?.id || '';
  const persona = await getPersonaById(id);
  if (!persona) {
    return NextResponse.json({ error: 'Persona not found', success: false }, { status: 404 });
  }
  return NextResponse.json({ persona });
});

export const PUT = withApi<{ id: string }>(
  async (request, context) => {
    const params = await context.params;
    const id = params?.id || '';
    const body = await request.json();
    const { changeSummary, ...rawInput } = body;
    const input = updatePersonaSchema.parse(rawInput);

    const persona = await updatePersona(id, input, context.user.userId, changeSummary);
    return NextResponse.json({ success: true, persona });
  },
  { permission: 'manage_persona' },
);

export const DELETE = withApi<{ id: string }>(
  async (_request, context) => {
    const params = await context.params;
    const id = params?.id || '';
    const result = await deletePersona(id, context.user.userId);
    return NextResponse.json(result);
  },
  { permission: 'manage_persona' },
);
