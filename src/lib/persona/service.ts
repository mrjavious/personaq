import prisma from '@/lib/db/prisma';
import { validatePersonaGuardrails } from '@/lib/guardrails/rules';
import { logAuditEvent } from '@/lib/audit/logger';

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
          changeSummary: 'Initial persona bible creation',
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
        changeSummary: changeSummary || `Updated persona bible (v${nextVersion})`,
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
