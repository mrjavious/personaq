import prisma from '@/lib/db/prisma';
import { validatePersonaGuardrails } from '@/lib/guardrails/rules';
import { logAuditEvent } from '@/lib/audit/logger';
import fs from 'fs';
import path from 'path';

export interface PersonaInput {
  name: string;
  adultAge: number;
  backstory: string;
  appearanceNotes: string;
  voiceTone: string;
  catchphrases: string[];
  boundaries: string[];
  contentPillars: string[];
  aiDisclosureText: string;
  avatarUrl?: string | null;
  visualModelConfig?: string | null;
}

export async function getActivePersona() {
  return prisma.persona.findFirst({
    include: {
      platformAccounts: true,
      versions: {
        orderBy: { versionNumber: 'desc' },
        take: 10,
      },
    },
  });
}
export async function getAllPersonas(limit = 50, offset = 0) {
  const [personas, total] = await Promise.all([
    prisma.persona.findMany({
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        platformAccounts: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
    }),
    prisma.persona.count(),
  ]);
  return { personas, total };
}

export async function getPersonaById(id: string) {
  return prisma.persona.findUnique({
    where: { id },
    include: {
      platformAccounts: true,
      versions: {
        orderBy: { versionNumber: 'desc' },
      },
    },
  });
}

export async function createPersona(input: PersonaInput, userId?: string) {
  // Validate Guardrails
  const validation = validatePersonaGuardrails({
    adultAge: input.adultAge,
    aiDisclosureText: input.aiDisclosureText,
    name: input.name,
  });

  if (!validation.valid) {
    throw new Error(`Guardrail Validation Failed: ${validation.errors.join('; ')}`);
  }

  const persona = await prisma.persona.create({
    data: {
      name: input.name,
      adultAge: input.adultAge,
      backstory: input.backstory,
      appearanceNotes: input.appearanceNotes,
      voiceTone: input.voiceTone,
      catchphrases: JSON.stringify(input.catchphrases || []),
      boundaries: JSON.stringify(input.boundaries || []),
      contentPillars: JSON.stringify(input.contentPillars || []),
      aiDisclosureText: input.aiDisclosureText,
      versions: {
        create: {
          versionNumber: 1,
          snapshotJson: JSON.stringify(input),
          changeSummary: 'Initial persona agent creation',
          createdById: userId,
        },
      },
    },
    include: { versions: true },
  });

  await logAuditEvent({
    userId,
    action: 'persona_update',
    entity: 'Persona',
    entityId: persona.id,
    meta: { event: 'created', name: persona.name, adultAge: persona.adultAge },
  });

  return persona;
}

export async function updatePersona(
  id: string,
  input: PersonaInput,
  userId?: string,
  changeSummary?: string
) {
  // Validate Guardrails
  const validation = validatePersonaGuardrails({
    adultAge: input.adultAge,
    aiDisclosureText: input.aiDisclosureText,
    name: input.name,
  });

  if (!validation.valid) {
    throw new Error(`Guardrail Validation Failed: ${validation.errors.join('; ')}`);
  }

  // Count existing versions to increment version number
  const versionCount = await prisma.personaVersion.count({
    where: { personaId: id },
  });

  const nextVersion = versionCount + 1;

  // Snapshot version and update persona in transaction
  const updatedPersona = await prisma.$transaction(async (tx) => {
    // 1. Record snapshot
    await tx.personaVersion.create({
      data: {
        personaId: id,
        versionNumber: nextVersion,
        snapshotJson: JSON.stringify(input),
        changeSummary: changeSummary || `Updated persona agent (v${nextVersion})`,
        createdById: userId,
      },
    });

    // 2. Update active persona
    return tx.persona.update({
      where: { id },
      data: {
        name: input.name,
        adultAge: input.adultAge,
        backstory: input.backstory,
        appearanceNotes: input.appearanceNotes,
        voiceTone: input.voiceTone,
        catchphrases: JSON.stringify(input.catchphrases || []),
        boundaries: JSON.stringify(input.boundaries || []),
        contentPillars: JSON.stringify(input.contentPillars || []),
        aiDisclosureText: input.aiDisclosureText,
        ...(input.avatarUrl !== undefined && { avatarUrl: input.avatarUrl }),
        ...(input.visualModelConfig !== undefined && { visualModelConfig: input.visualModelConfig }),
      },
      include: {
        platformAccounts: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 10,
        },
      },
    });
  });

  await logAuditEvent({
    userId,
    action: 'persona_update',
    entity: 'Persona',
    entityId: updatedPersona.id,
    meta: {
      event: 'updated',
      version: nextVersion,
      changeSummary: changeSummary || 'Persona updated',
    },
  });

  return updatedPersona;
}

export async function rollbackPersonaVersion(versionId: string, userId?: string) {
  const version = await prisma.personaVersion.findUnique({
    where: { id: versionId },
  });

  if (!version) {
    throw new Error('Version snapshot not found');
  }

  const parsedSnapshot: PersonaInput = JSON.parse(version.snapshotJson);

  return updatePersona(
    version.personaId,
    parsedSnapshot,
    userId,
    `Rollback to v${version.versionNumber}`
  );
}

export async function deletePersona(id: string, userId?: string) {
  const existing = await prisma.persona.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error('Persona not found');
  }

  const count = await prisma.persona.count();
  if (count <= 1) {
    throw new Error('Cannot delete the only remaining persona. At least one persona is required.');
  }

  // Delete uploaded directory if exists
  const personaDir = path.resolve(process.cwd(), `public/uploads/personas/${id}`);
  if (fs.existsSync(personaDir)) {
    try {
      fs.rmSync(personaDir, { recursive: true, force: true });
    } catch (e) {
      console.warn('Failed to delete persona upload directory:', e);
    }
  }

  // Cascade delete in Prisma
  await prisma.persona.delete({
    where: { id },
  });

  await logAuditEvent({
    userId,
    action: 'persona_update',
    entity: 'Persona',
    entityId: id,
    meta: {
      event: 'deleted',
      name: existing.name,
    },
  });

  const remaining = await getAllPersonas();
  return { success: true, remaining, deletedId: id, deletedName: existing.name };
}

