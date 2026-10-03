import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '@/lib/db/prisma';
import { validatePersonaGuardrails, validatePostVariantSuitability } from '@/lib/guardrails/rules';
import { publishVariant, reconcilePostStatus } from '@/lib/publishing';
import { recordPrivacyClickEvent, getAggregatedClickMetrics } from '@/lib/links/utm';
import { verifyAuditLogChain } from '@/lib/audit/service';
import { logAuditEvent, verifyAuditSignature } from '@/lib/audit/logger';
import { runScheduledComplianceCheck, getLatestComplianceCheck } from '@/lib/compliance/scheduler';


describe('End-to-End Persona Lifecycle Journey', () => {
  const testId = `e2e_${Date.now()}`;
  let personaId: string;
  let referenceAssetId: string;
  let sfwAssetId: string;
  let adultAssetId: string;
  let igAccountId: string;
  let fanvueAccountId: string;
  let postId: string;
  let igVariantId: string;
  let fanvueVariantId: string;
  let linkId: string;

  beforeAll(async () => {
    // Clean up any old test entities with testId prefix
  });

  afterAll(async () => {
    // Clean up test entities created during journey
    if (postId) {
      await prisma.postVariant.deleteMany({ where: { postId } }).catch(() => {});
      await prisma.post.delete({ where: { id: postId } }).catch(() => {});
    }
    if (linkId) {
      await prisma.clickEvent.deleteMany({ where: { linkId } }).catch(() => {});
      await prisma.linkHub.delete({ where: { id: linkId } }).catch(() => {});
    }
    if (referenceAssetId || sfwAssetId || adultAssetId) {
      await prisma.asset.deleteMany({
        where: { id: { in: [referenceAssetId, sfwAssetId, adultAssetId].filter(Boolean) } },
      }).catch(() => {});
    }
    if (igAccountId || fanvueAccountId) {
      await prisma.platformAccount.deleteMany({
        where: { id: { in: [igAccountId, fanvueAccountId].filter(Boolean) } },
      }).catch(() => {});
    }
    if (personaId) {
      await prisma.personaVersion.deleteMany({ where: { personaId } }).catch(() => {});
      await prisma.persona.delete({ where: { id: personaId } }).catch(() => {});
    }
  });

  describe('Stage 1: Persona Creation & Non-Negotiable Guardrails', () => {
    it('strictly enforces Section 2 adult age and mandatory AI disclosure', () => {
      // 1. Minor (<18) must fail
      const minorCheck = validatePersonaGuardrails({
        adultAge: 16,
        aiDisclosureText: 'AI Creator',
      });
      expect(minorCheck.valid).toBe(false);
      expect(minorCheck.errors[0]).toContain('Minors are strictly prohibited');

      // 2. Missing disclosure text must fail
      const disclosureCheck = validatePersonaGuardrails({
        adultAge: 24,
        aiDisclosureText: '',
      });
      expect(disclosureCheck.valid).toBe(false);
      expect(disclosureCheck.errors[0]).toContain('AI disclosure text is mandatory');

      // 3. Valid persona parameters must pass
      const validCheck = validatePersonaGuardrails({
        adultAge: 24,
        aiDisclosureText: 'Disclosed Fictional AI Persona: Created with synthetic generative tools.',
      });
      expect(validCheck.valid).toBe(true);
      expect(validCheck.errors).toHaveLength(0);
    });

    it('creates compliant persona record in database and logs audit event', async () => {
      const persona = await prisma.persona.create({
        data: {
          name: `Aria Nova ${testId}`,
          adultAge: 24,
          backstory: 'A digital artist and AI creator living in Neo-Arcadia.',
          appearanceNotes: 'Silver styled bob, luminous violet eyes, cyber aesthetic.',
          voiceTone: 'Thoughtful, curious, approachable, creative.',
          aiDisclosureText: 'Disclosed Fictional AI Persona: Created with synthetic generative tools.',
          catchphrases: JSON.stringify(['Pixels to poetry', 'Code meets canvas']),
          contentPillars: JSON.stringify(['Digital Art', 'Cyberpunk Aesthetics']),
        },
      });

      expect(persona).toBeDefined();
      expect(persona.id).toBeDefined();
      personaId = persona.id;

      await logAuditEvent({
        action: 'persona_update',
        entity: 'Persona',
        entityId: persona.id,
        meta: { event: 'created', name: persona.name },
      });
    });
  });

  describe('Stage 2: Reference Image Upload & Face Card Identity Anchoring', () => {
    it('uploads reference face image and locks identity anchor with version snapshot', async () => {
      // 1. Create reference face asset
      const refAsset = await prisma.asset.create({
        data: {
          personaId,
          storageKey: `references/${testId}-face.jpg`,
          url: `/uploads/references/${testId}-face.jpg`,
          type: 'image',
          suitability: 'sfw_safe',
          aiGenerated: true,
          safetyStatus: 'passed',
          provenanceMeta: JSON.stringify({
            kind: 'reference_face',
            resolution: '1024x1024',
            lockedAt: new Date().toISOString(),
          }),
        },
      });
      expect(refAsset).toBeDefined();
      referenceAssetId = refAsset.id;

      // 2. Lock face anchor on persona
      const modelConfig = {
        isFaceLocked: true,
        lockedFaceUrl: refAsset.url,
        lockedAssetId: refAsset.id,
        basePrompt: 'Aria Nova, cyber digital artist',
      };

      const updatedPersona = await prisma.persona.update({
        where: { id: personaId },
        data: {
          avatarUrl: refAsset.url,
          visualModelConfig: JSON.stringify(modelConfig),
        },
      });
      expect(updatedPersona.avatarUrl).toBe(refAsset.url);

      // 3. Create versioned snapshot in PersonaVersion
      const version = await prisma.personaVersion.create({
        data: {
          personaId,
          versionNumber: 1,
          snapshotJson: JSON.stringify({
            name: updatedPersona.name,
            adultAge: updatedPersona.adultAge,
            backstory: updatedPersona.backstory,
            visualModelConfig: modelConfig,
          }),
          changeSummary: 'Initial face anchor lock',
        },
      });
      expect(version.versionNumber).toBe(1);

      await logAuditEvent({
        action: 'settings_change',
        entity: 'Persona',
        entityId: personaId,
        meta: { action: 'face_locked', version: 1, assetId: refAsset.id },
      });
    });
  });

  describe('Stage 3: Multi-Platform Asset Generation & Guardrail 4 Enforcement', () => {
    it('creates SFW and Adult creator assets with synthetic disclosure watermarks', async () => {
      // SFW Asset for Instagram
      const sfwAsset = await prisma.asset.create({
        data: {
          personaId,
          storageKey: `content/${testId}-sfw.jpg`,
          url: `/uploads/content/${testId}-sfw.jpg`,
          type: 'image',
          suitability: 'sfw_safe',
          aiGenerated: true,
          safetyStatus: 'passed',
          provenanceMeta: JSON.stringify({ watermarked: true, disclosure: 'synthetic_c2pa' }),
        },
      });
      sfwAssetId = sfwAsset.id;

      // Adult Asset for Fanvue
      const adultAsset = await prisma.asset.create({
        data: {
          personaId,
          storageKey: `content/${testId}-adult.jpg`,
          url: `/uploads/content/${testId}-adult.jpg`,
          type: 'image',
          suitability: 'adult_only',
          aiGenerated: true,
          safetyStatus: 'passed',
          provenanceMeta: JSON.stringify({ watermarked: true, disclosure: 'synthetic_c2pa' }),
        },
      });
      adultAssetId = adultAsset.id;

      expect(sfwAsset.suitability).toBe('sfw_safe');
      expect(adultAsset.suitability).toBe('adult_only');
    });

    it('enforces Guardrail 4: strictly blocks adult_only assets on Instagram while allowing them on Fanvue', () => {
      // Attempt adult_only on Instagram
      const igAdultCheck = validatePostVariantSuitability('instagram', 'adult_only');
      expect(igAdultCheck.valid).toBe(false);
      expect(igAdultCheck.errors[0]).toContain("CRITICAL GUARDRAIL VIOLATION: 'adult_only' asset cannot be scheduled or published to SFW platform 'instagram'");

      // SFW asset on Instagram is valid
      const igSfwCheck = validatePostVariantSuitability('instagram', 'sfw_safe');
      expect(igSfwCheck.valid).toBe(true);

      // Adult asset on Fanvue is valid
      const fanvueAdultCheck = validatePostVariantSuitability('fanvue', 'adult_only');
      expect(fanvueAdultCheck.valid).toBe(true);
    });
  });

  describe('Stage 4: Post Creation, Scheduling & Idempotent Publishing Dispatch', () => {
    it('creates post, platform accounts, and scheduled variants', async () => {
      // Create Post
      const post = await prisma.post.create({
        data: {
          personaId,
          concept: 'Cyber Art Exhibition Launch',
          status: 'scheduled',
        },
      });
      postId = post.id;

      // Create Platform Accounts
      const igAccount = await prisma.platformAccount.create({
        data: {
          personaId,
          platform: 'instagram',
          handle: `@arianova_${testId}`,
          apiStatus: 'active',
          disclosureInBio: true,
        },
      });
      igAccountId = igAccount.id;

      const fanvueAccount = await prisma.platformAccount.create({
        data: {
          personaId,
          platform: 'fanvue',
          handle: `arianova_${testId}`,
          apiStatus: 'active',
          disclosureInBio: true,
        },
      });
      fanvueAccountId = fanvueAccount.id;

      // Create Instagram Variant (SFW asset)
      const igVariant = await prisma.postVariant.create({
        data: {
          postId,
          platformAccountId: igAccountId,
          assetId: sfwAssetId,
          caption: 'Neon dreams come alive in Neo-Arcadia! #AI #DigitalArt',
          aiLabelApplied: true,
          scheduledAt: new Date(Date.now() - 5000),
        },
      });
      igVariantId = igVariant.id;

      // Create Fanvue Variant (Adult asset)
      const fanvueVariant = await prisma.postVariant.create({
        data: {
          postId,
          platformAccountId: fanvueAccountId,
          assetId: adultAssetId,
          caption: 'Exclusive full-resolution gallery now live for VIP subscribers! #creator',
          aiLabelApplied: true,
          scheduledAt: new Date(Date.now() - 5000),
        },
      });
      fanvueVariantId = fanvueVariant.id;

      expect(igVariant.id).toBeDefined();
      expect(fanvueVariant.id).toBeDefined();
    });

    it('dispatches variants idempotently across Instagram and Fanvue adapters', async () => {
      // 1. Dispatch Instagram variant
      const igResult1 = await publishVariant(igVariantId, 'journey_tester');
      expect(igResult1.status).toBe('published');
      expect(igResult1.externalId).toBeDefined();
      expect(igResult1.externalId).toContain('ig_sim_');

      // Verify DB updated
      const igVariantDb = await prisma.postVariant.findUnique({ where: { id: igVariantId } });
      expect(igVariantDb?.publishedAt).not.toBeNull();
      expect(igVariantDb?.externalId).toBe(igResult1.externalId);

      // 2. Second dispatch attempt on same variant returns identical externalId without duplicate posting
      const igResult2 = await publishVariant(igVariantId, 'journey_tester');
      expect(igResult2.status).toBe('published');
      expect(igResult2.externalId).toBe(igResult1.externalId);

      // 3. Dispatch Fanvue variant
      const fanvueResult = await publishVariant(fanvueVariantId, 'journey_tester');
      expect(fanvueResult.status).toBe('published');
      expect(fanvueResult.externalId).toContain('fanvue_sim_');

      const fanvueVariantDb = await prisma.postVariant.findUnique({ where: { id: fanvueVariantId } });
      expect(fanvueVariantDb?.publishedAt).not.toBeNull();
    });

    it('automatically reconciles post status to published when all variants complete', async () => {
      const reconciled = await reconcilePostStatus(postId, 'journey_reconciler');
      expect(reconciled.newStatus).toBe('published');

      const postDb = await prisma.post.findUnique({ where: { id: postId } });
      expect(postDb?.status).toBe('published');
    });
  });

  describe('Stage 5: Community Engagement & Draft Reply Review', () => {
    it('generates and approves in-character draft replies', async () => {
      // Simulate fan comment incoming
      const draftReply = await prisma.draftReply.create({
        data: {
          platformAccountId: igAccountId,
          contextText: 'Love the color palette! Is this inspired by 80s synthwave?',
          suggestedText: 'Exactly! Synthwave meets cyber-futurism. Thanks for noticing the palette! ✨',
          status: 'draft',
        },
      });

      expect(draftReply.status).toBe('draft');

      // Human-in-the-loop review approves draft
      const approvedReply = await prisma.draftReply.update({
        where: { id: draftReply.id },
        data: { status: 'approved' },
      });

      expect(approvedReply.status).toBe('approved');

      await logAuditEvent({
        action: 'approve',
        entity: 'DraftReply',
        entityId: approvedReply.id,
        meta: { platform: 'instagram', approvedBy: 'reviewer_1' },
      });

      // Cleanup reply
      await prisma.draftReply.delete({ where: { id: draftReply.id } });
    });
  });

  describe('Stage 6: Neutral Landing Hub & Privacy-Preserving Traffic Tracking', () => {
    it('creates neutral hub, records privacy-sanitized click events, and computes aggregated metrics', async () => {
      const link = await prisma.linkHub.create({
        data: {
          personaId,
          slug: `hub-${testId}`,
          destinationUrl: `https://fanvue.com/arianova_${testId}`,
          isNeutralLanding: true,
        },
      });
      linkId = link.id;

      // 1. Click with DNT: 1 header
      const privacyHeaders = new Headers();
      privacyHeaders.set('dnt', '1');
      const clickEvent = await recordPrivacyClickEvent({
        linkId: link.id,
        utmSource: 'instagram_bio',
        utmCampaign: 'launch_week',
        referrer: 'https://instagram.com/arianova/profile/tracking?token=xyz',
        headers: privacyHeaders,
      });

      // Referrer must be stripped to protocol + domain only, zero PII
      expect(clickEvent.referrer).toBe('https://instagram.com');

      // 2. Aggregated metrics calculation
      const metrics = await getAggregatedClickMetrics(link.id);
      expect(metrics.totalClicks).toBeGreaterThanOrEqual(1);
      expect(metrics.clicksBySource['instagram_bio']).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Stage 7: Compliance Governance Scorecard & Snapshot History', () => {
    it('verifies 100% Guardrail 4 compliance and saves snapshot to ComplianceSnapshot', async () => {
      const checkResult = await runScheduledComplianceCheck();

      expect(checkResult.passed).toBe(true);
      expect(checkResult.criticalIssues).toBe(0);
      expect(checkResult.report?.postAudit.adultAssetOnSfwViolations).toBe(0);

      // Verify latest compliance check is retrievable
      const latest = await getLatestComplianceCheck();
      expect(latest).toBeDefined();
      expect(latest?.id).toBe(checkResult.id);
      expect(latest?.passed).toBe(true);
    });
  });

  describe('Stage 8: Tamper-Evident Cryptographic Audit Verification', () => {
    it('validates the entire cryptographic HMAC audit trail across the persona lifecycle', async () => {
      // Find audit logs recorded for this persona journey
      const journeyLogs = await prisma.auditLog.findMany({
        where: {
          OR: [
            { entityId: personaId },
            { entityId: postId },
            { entityId: igVariantId },
            { entityId: fanvueVariantId },
          ],
        },
        orderBy: { ts: 'asc' },
      });

      expect(journeyLogs.length).toBeGreaterThanOrEqual(3);
      for (const log of journeyLogs) {
        expect(log.meta).toBeDefined();
        const parsed = JSON.parse(log.meta!);
        expect(parsed._crypto).toBeDefined();
        expect(parsed._crypto.alg).toBe('HMAC-SHA256');
        expect(parsed._crypto.signature).toBeDefined();
        expect(parsed._crypto.hash).toBeDefined();

        // 1. Verify constant-time HMAC-SHA256 signature
        const isSigValid = verifyAuditSignature(parsed._crypto.hash, parsed._crypto.signature);
        expect(isSigValid).toBe(true);
      }

      // 2. Cryptographic chain verification on journey record slice
      if (journeyLogs.length > 0) {
        const sliceVerify = await verifyAuditLogChain({ records: [journeyLogs[0]] });
        expect(sliceVerify.valid).toBe(true);
      }
    });
  });
});


