import { describe, it, expect, vi } from 'vitest';
import {
  generateDraftSuggestions,
  createDraftReply,
  approveDraftReply,
  discardDraftReply,
  listDraftReplies,
} from '@/lib/engagement/service';
import { prisma } from '@/lib/db';
import { compositeProvider } from '@/lib/ai';

describe('Phase 6: Engagement Assistant & Guardrail 5 (Human-in-the-Loop)', () => {
  let sampleAccountId: string;

  it('sets up a test platform account for engagement testing', async () => {
    let persona = await prisma.persona.findFirst();
    if (!persona) {
      persona = await prisma.persona.create({
        data: {
          name: 'Aria Nova',
          adultAge: 26,
          backstory: 'Digital artist in Neo-Arcadia.',
          appearanceNotes: 'Stylized digital character with lavender hair and modern techwear.',
          voiceTone: 'Thoughtful, curious, witty.',
          catchphrases: JSON.stringify(['Digital dreams into pixels']),
          boundaries: JSON.stringify(['Never simulate real grief']),
          aiDisclosureText: '✨ Disclosed Fictional AI Persona',
        },
      });
    }

    const account = await prisma.platformAccount.findFirst({
      where: { personaId: persona.id, platform: 'instagram' },
    });

    if (account) {
      sampleAccountId = account.id;
    } else {
      const created = await prisma.platformAccount.create({
        data: {
          personaId: persona.id,
          platform: 'instagram',
          handle: '@aria.nova.test',
          apiStatus: 'active',
          disclosureInBio: true,
        },
      });
      sampleAccountId = created.id;
    }

    expect(sampleAccountId).toBeDefined();
  });

  describe('generateDraftSuggestions (Drafts Only)', () => {
    it('generates 3 in-character suggested replies without sending anything automatically', async () => {
      vi.spyOn(compositeProvider, 'draftReply').mockResolvedValueOnce({
        provider: 'fallback_template',
        suggestions: [
          'Thank you so much! Exploring neural color grading in this piece. ✨',
          'Appreciate your curiosity! Built with stylized character workflows.',
          'Digital dreams compile into reality! Thanks for following along.',
        ],
      });

      const result = await generateDraftSuggestions({
        platformAccountId: sampleAccountId,
        contextText: 'I love your digital lighting experiments! How did you compose this?',
      });

      expect(result.platform).toBe('instagram');
      expect(result.suggestions).toHaveLength(3);
      result.suggestions.forEach((s) => {
        expect(typeof s).toBe('string');
        expect(s.length).toBeGreaterThan(10);
      });
    });

    it('filters out any explicit or inappropriate words from suggestions', async () => {
      vi.spyOn(compositeProvider, 'draftReply').mockResolvedValueOnce({
        provider: 'fallback_template',
        suggestions: [
          'This is a clean, compliant reply about digital art.',
          'Forbidden explicit nsfw text with nude words should be stripped.',
        ],
      });

      const result = await generateDraftSuggestions({
        platformAccountId: sampleAccountId,
        contextText: 'Great render!',
      });

      result.suggestions.forEach((s) => {
        expect(s.toLowerCase()).not.toContain('nsfw');
        expect(s.toLowerCase()).not.toContain('nude');
      });
    });
  });

  describe('Draft Reply Lifecycle & Explicit Approval Gate', () => {
    let createdDraftId: string;

    it('creates a draft with status "draft" waiting for explicit human review', async () => {
      const draft = await createDraftReply({
        platformAccountId: sampleAccountId,
        contextText: 'What software did you use?',
        suggestedText: 'Thanks! I use generative workflows compiled with creative code.',
      });

      expect(draft.id).toBeDefined();
      expect(draft.status).toBe('draft');
      createdDraftId = draft.id;
    });

    it('rejects proposed replies that violate the content safety filter', async () => {
      await expect(
        createDraftReply({
          platformAccountId: sampleAccountId,
          contextText: 'Inappropriate query',
          suggestedText: 'This is an explicit nsfw reply containing nude elements',
        })
      ).rejects.toThrow(/Content filter violation/);
    });

    it('approves a draft only upon explicit user action and records an audit log', async () => {
      const approved = await approveDraftReply({
        id: createdDraftId,
        editedText: 'Thanks! I use generative workflows compiled with custom code. ✨',
        userId: 'creator_test_user',
      });

      expect(approved.status).toBe('approved');
      expect(approved.suggestedText).toContain('custom code');

      // Verify AuditLog was recorded
      const auditLog = await prisma.auditLog.findFirst({
        where: { entityId: createdDraftId, action: 'approve' },
      });
      expect(auditLog).toBeDefined();
      expect(auditLog?.action).toBe('approve');
    });

    it('discards a draft reply when rejected by the user', async () => {
      const discardedDraft = await createDraftReply({
        platformAccountId: sampleAccountId,
        contextText: 'Spam comment',
        suggestedText: 'Generic reply',
      });

      const updated = await discardDraftReply(discardedDraft.id, 'creator_test_user');
      expect(updated.status).toBe('discarded');
    });

    it('lists drafts filtered by status', async () => {
      const allApproved = await listDraftReplies({ status: 'approved' });
      expect(Array.isArray(allApproved)).toBe(true);
      allApproved.forEach((d) => {
        expect(d.status).toBe('approved');
      });
    });
  });
});
