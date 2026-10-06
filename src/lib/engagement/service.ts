import { prisma } from '@/lib/db';
import { compositeProvider } from '@/lib/ai';
import { filterAiText } from '@/lib/ai/content-filter';
import { logAuditEvent } from '@/lib/audit/logger';

export interface GenerateDraftsRequest {
  platformAccountId: string;
  contextText: string;
}

export interface GeneratedDraftOptions {
  platform: string;
  contextText: string;
  suggestions: string[];
}

export interface CreateDraftReplyInput {
  platformAccountId: string;
  contextText: string;
  suggestedText: string;
}

export interface ApproveDraftInput {
  id: string;
  editedText?: string;
  userId?: string;
}

/**
 * Section 2 Guardrail 5:
 * Human-in-the-loop: No outbound comment, reply, or DM is ever sent automatically.
 * AI produces drafts; the user approves and sends.
 */
export async function generateDraftSuggestions(
  input: GenerateDraftsRequest
): Promise<GeneratedDraftOptions> {
  const account = await prisma.platformAccount.findUnique({
    where: { id: input.platformAccountId },
    include: { persona: true },
  });

  if (!account) {
    throw new Error('Platform account not found');
  }

  const persona = account.persona;
  const catchphrases: string[] = persona.catchphrases
    ? JSON.parse(persona.catchphrases)
    : [];
  const boundaries: string[] = persona.boundaries
    ? JSON.parse(persona.boundaries)
    : [];

  // Generate suggestions via Composite Text Provider (OpenAI-compatible / Ollama / Fallback)
  const result = await compositeProvider.draftReply({
    contextText: input.contextText,
    platform: account.platform,
    persona: {
      name: persona.name,
      voiceTone: persona.voiceTone,
      catchphrases,
      boundaries,
    },
  });

  // Filter generated suggestions for content safety & boundaries
  const sanitizedSuggestions = result.suggestions
    .map((s) => s.trim())
    .filter((s) => {
      const check = filterAiText(s);
      return check.passed;
    });

  const finalSuggestions =
    sanitizedSuggestions.length > 0
      ? sanitizedSuggestions
      : [
          `Thank you for following along! I love creating in this digital frontier. ✨`,
          `Appreciate your thoughtful perspective! What creative projects are you exploring?`,
          `Sending digital good vibes your way! Thanks for being part of the community.`,
        ];

  return {
    platform: account.platform,
    contextText: input.contextText,
    suggestions: finalSuggestions,
  };
}

export async function createDraftReply(input: CreateDraftReplyInput) {
  // Guardrail check: filter proposed reply text
  const check = filterAiText(input.suggestedText);
  if (!check.passed) {
    throw new Error(`Content filter violation in reply: ${check.violations.join(', ')}`);
  }

  return await prisma.draftReply.create({
    data: {
      platformAccountId: input.platformAccountId,
      contextText: input.contextText.trim(),
      suggestedText: input.suggestedText.trim(),
      status: 'draft',
    },
    include: {
      platformAccount: {
        select: { platform: true, handle: true },
      },
    },
  });
}

export async function approveDraftReply(input: ApproveDraftInput) {
  const existing = await prisma.draftReply.findUnique({
    where: { id: input.id },
  });

  if (!existing) {
    throw new Error('Draft reply not found');
  }

  const textToSave = input.editedText !== undefined ? input.editedText.trim() : existing.suggestedText;

  // Filter check on edit
  const check = filterAiText(textToSave);
  if (!check.passed) {
    throw new Error(`Content filter violation in edited reply: ${check.violations.join(', ')}`);
  }

  const updated = await prisma.draftReply.update({
    where: { id: input.id },
    data: {
      status: 'approved',
      suggestedText: textToSave,
    },
    include: {
      platformAccount: {
        select: { platform: true, handle: true },
      },
    },
  });

  await logAuditEvent({
    userId: input.userId,
    action: 'approve',
    entity: 'DraftReply',
    entityId: updated.id,
    meta: {
      action: 'draft_approved',
      platform: updated.platformAccount.platform,
      handle: updated.platformAccount.handle,
      status: 'approved',
      guarantee: 'human_in_the_loop_manual_send_only',
    },
  });

  return updated;
}

export async function discardDraftReply(id: string, userId?: string) {
  const updated = await prisma.draftReply.update({
    where: { id },
    data: { status: 'discarded' },
  });

  await logAuditEvent({
    userId,
    action: 'settings_change',
    entity: 'DraftReply',
    entityId: id,
    meta: { action: 'draft_discarded' },
  });

  return updated;
}

export async function listDraftReplies(filter?: {
  platformAccountId?: string;
  status?: string;
}) {
  const where: Record<string, unknown> = {};
  if (filter?.platformAccountId) where.platformAccountId = filter.platformAccountId;
  if (filter?.status && filter.status !== 'all') where.status = filter.status;

  return await prisma.draftReply.findMany({
    where,
    include: {
      platformAccount: {
        select: { id: true, platform: true, handle: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function deleteDraftReply(id: string) {
  return await prisma.draftReply.delete({ where: { id } });
}
