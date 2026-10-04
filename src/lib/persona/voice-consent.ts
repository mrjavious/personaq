import prisma from '@/lib/db/prisma';

export interface RecordVoiceConsentInput {
  voiceId: string;
  who: string;
  scope: string;
  notes?: string;
  when?: Date;
}

export async function recordVoiceConsent(input: RecordVoiceConsentInput) {
  const { voiceId, who, scope, notes, when } = input;

  return prisma.voiceConsent.upsert({
    where: { voiceId },
    create: {
      voiceId,
      who,
      scope,
      notes,
      when: when || new Date(),
      revokedAt: null,
    },
    update: {
      who,
      scope,
      notes,
      revokedAt: null,
      updatedAt: new Date(),
    },
  });
}

export async function revokeVoiceConsent(voiceId: string) {
  return prisma.voiceConsent.update({
    where: { voiceId },
    data: {
      revokedAt: new Date(),
    },
  });
}

export async function getVoiceConsent(voiceId: string) {
  return prisma.voiceConsent.findUnique({
    where: { voiceId },
  });
}

export async function listVoiceConsents(includeRevoked = false) {
  return prisma.voiceConsent.findMany({
    where: includeRevoked ? undefined : { revokedAt: null },
    orderBy: { createdAt: 'desc' },
  });
}
