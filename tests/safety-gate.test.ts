import { describe, it, expect } from 'vitest';
import {
  evaluateApparentAge,
  evaluateRealPersonLikeness,
  evaluatePlatformSfw,
  runSafetyGatePipeline,
  overrideSafetyDecision,
} from '@/lib/safety/pipeline';
import prisma from '@/lib/db/prisma';

describe('Safety Gate Pipeline (Section 5.3)', () => {
  describe('Sub-Classifier 1: Apparent Age Check', () => {
    it('should hard-block any asset flagged as minor (age < 18)', async () => {
      const res = await evaluateApparentAge({
        customScores: { apparentAge: 16, youthLikelihood: 0.9 },
      });
      expect(res.status).toBe('blocked');
      expect(res.details).toContain('under 18');
    });

    it('should hard-block youthful appearances below recommended adult age (< 21)', async () => {
      const res = await evaluateApparentAge({
        customScores: { apparentAge: 19, youthLikelihood: 0.35 },
      });
      expect(res.status).toBe('blocked');
      expect(res.details).toContain('adult threshold of 21 years');
    });

    it('should hard-block keywords related to minors in prompts or tags', async () => {
      const res = await evaluateApparentAge({
        metadata: { prompt: 'a portrait of a schoolgirl in anime style' },
      });
      expect(res.status).toBe('blocked');
      expect(res.details).toContain('youthful/minor keywords');
    });

    it('should not false-positive block words with substrings like nineteen or skid', async () => {
      const res = await evaluateApparentAge({
        metadata: { prompt: 'a chic nineteen twenties retro scene with a skid mark on asphalt' },
        customScores: { apparentAge: 25, youthLikelihood: 0.05 },
      });
      expect(res.status).toBe('passed');
    });

    it('should pass mature adult persona (>= 21)', async () => {
      const res = await evaluateApparentAge({
        customScores: { apparentAge: 27, youthLikelihood: 0.04 },
      });
      expect(res.status).toBe('passed');
      expect(res.estimatedAge).toBe(27);
    });
  });

  describe('Sub-Classifier 2: Real-Person Likeness Check', () => {
    it('should hard-block high likeness to real persons/celebrities (>= 70%)', async () => {
      const res = await evaluateRealPersonLikeness({
        customScores: { realPersonLikeness: 0.85, matchedCelebrity: 'Known Public Figure' },
      });
      expect(res.status).toBe('blocked');
      expect(res.score).toBe(0.85);
    });

    it('should flag borderline likeness (45% - 70%) for manual review', async () => {
      const res = await evaluateRealPersonLikeness({
        customScores: { realPersonLikeness: 0.55, matchedCelebrity: 'Resembles Public Figure' },
      });
      expect(res.status).toBe('review');
    });

    it('should pass unique fictional characters (likeness < 45%)', async () => {
      const res = await evaluateRealPersonLikeness({
        customScores: { realPersonLikeness: 0.05 },
      });
      expect(res.status).toBe('passed');
    });
  });

  describe('Sub-Classifier 3: Platform SFW Check', () => {
    it('should block explicit content on sfw_safe assets', async () => {
      const res = await evaluatePlatformSfw({
        metadata: { suitability: 'sfw_safe' },
        customScores: { nsfwScore: 0.82 },
      });
      expect(res.status).toBe('blocked');
    });

    it('should flag borderline suggestive content for manual review', async () => {
      const res = await evaluatePlatformSfw({
        metadata: { suitability: 'sfw_safe' },
        customScores: { nsfwScore: 0.45 },
      });
      expect(res.status).toBe('review');
    });

    it('should pass clean SFW content', async () => {
      const res = await evaluatePlatformSfw({
        metadata: { suitability: 'sfw_safe' },
        customScores: { nsfwScore: 0.01 },
      });
      expect(res.status).toBe('passed');
    });
  });

  describe('Fail-Safe Behavior', () => {
    it('should default to pending and NEVER passed when classifier fails', async () => {
      const res = await runSafetyGatePipeline({
        forceClassifierFailure: true,
      });
      expect(res.status).toBe('pending');
      expect(res.reasons[0]).toContain('FAIL-SAFE TRIGGERED');
    });
  });

  describe('Manual Review Override Rules (Section 5.3)', () => {
    it('should strictly refuse to override hard-blocked assets into SFW queues', async () => {
      // Create a test asset with blocked status
      const persona = await prisma.persona.findFirst();
      const blockedAsset = await prisma.asset.create({
        data: {
          personaId: persona!.id,
          storageKey: 'test/blocked.jpg',
          safetyStatus: 'blocked',
          suitability: 'sfw_safe',
        },
      });

      await expect(
        overrideSafetyDecision(blockedAsset.id, 'admin_user', 'Attempting illegal override')
      ).rejects.toThrow(/CRITICAL GUARDRAIL ENFORCEMENT: Hard-blocked assets/);

      // Cleanup
      await prisma.asset.delete({ where: { id: blockedAsset.id } });
    });

    it('should allow manual override for borderline review cases with required justification', async () => {
      const persona = await prisma.persona.findFirst();
      const reviewAsset = await prisma.asset.create({
        data: {
          personaId: persona!.id,
          storageKey: 'test/review.jpg',
          safetyStatus: 'needs_manual_review',
          suitability: 'sfw_safe',
        },
      });

      const updated = await overrideSafetyDecision(
        reviewAsset.id,
        'creator@personaq.local',
        'Verified image is stylistically shaded neon art and fully compliant SFW.'
      );

      expect(updated.safetyStatus).toBe('passed');
      expect(updated.safetyReasons).toContain('MANUAL OVERRIDE APPROVED');

      // Cleanup
      await prisma.asset.delete({ where: { id: reviewAsset.id } });
    });
  });
});
