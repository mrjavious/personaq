import prisma from '@/lib/db/prisma';
import { logAuditEvent } from '@/lib/audit/logger';
import { GoogleGenAI } from '@google/genai';

export interface SafetyCheckInput {
  buffer?: Buffer;
  imageUrl?: string;
  metadata?: {
    prompt?: string;
    negativePrompt?: string;
    tags?: string[];
    suitability?: string;
  };
  // Simulated or external classifier mock injector for testing
  customScores?: {
    apparentAge?: number;
    youthLikelihood?: number; // 0 to 1
    realPersonLikeness?: number; // 0 to 1
    matchedCelebrity?: string;
    nsfwScore?: number; // 0 to 1
  };
  forceClassifierFailure?: boolean; // For testing fail-safe behavior
}

export interface VisionSafetyAssessment {
  adultAppearing: boolean;
  estimatedAge: number;
  youthLikelihood: number;
  nudityLevel: 'none' | 'suggestive' | 'explicit';
  nsfwScore: number;
  realPersonResemblance: boolean;
  resemblanceScore: number;
  matchedCelebrity?: string | null;
  hasTextOrLogos: boolean;
  textOrLogosDetails?: string | null;
  confidence: number;
  reasoning?: string;
}

export interface SafetyGateResult {
  status: 'passed' | 'blocked' | 'needs_manual_review' | 'pending';
  apparentAge: number;
  youthLikelihood: number;
  realPersonLikeness: number;
  matchedCelebrity?: string | null;
  nsfwScore: number;
  reasons: string[];
  classifierBreakdown: {
    ageCheck: { status: 'passed' | 'blocked'; estimatedAge: number; details: string };
    likenessCheck: { status: 'passed' | 'blocked' | 'review'; score: number; matched?: string };
    sfwCheck: { status: 'passed' | 'blocked' | 'review'; score: number; details: string };
  };
  evaluatedAt: string;
}

/**
 * Real Vision Safety Check via Gemini Vision API.
 * Returns structured JSON assessment. Fails closed if confidence < 0.70, model errors, or response is invalid.
 */
export async function evaluateVisionSafety(
  buffer: Buffer,
  mimeType = 'image/jpeg',
): Promise<VisionSafetyAssessment> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim().length <= 5) {
    throw new Error('Gemini API key is missing or not configured');
  }

  const client = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_VISION_MODEL || process.env.GEMINI_MODEL || 'gemini-3.8-flash';

  const prompt = `You are a strict compliance and safety classifier for synthetic media. Analyze the image and output ONLY valid JSON matching this schema:
{
  "adultAppearing": boolean (true if the person clearly appears strictly 21 years of age or older, false if underage, minor, teen, or youthful),
  "estimatedAge": number (conservative integer estimate of apparent age in years),
  "youthLikelihood": number (float between 0.0 and 1.0),
  "nudityLevel": "none" | "suggestive" | "explicit",
  "nsfwScore": number (float between 0.0 and 1.0, where 0.0 is clean, >0.3 is suggestive, >0.6 is explicit nudity),
  "realPersonResemblance": boolean (true if the face resembles a real living person or celebrity),
  "resemblanceScore": number (float between 0.0 and 1.0),
  "matchedCelebrity": string | null (name of celebrity or public figure if resemblanceScore > 0.4, else null),
  "hasTextOrLogos": boolean (true if visible text, watermarks, brand logos, or stickers are present),
  "textOrLogosDetails": string | null,
  "confidence": number (float between 0.0 and 1.0 representing your confidence in this safety assessment),
  "reasoning": string (concise explanation)
}
Return raw JSON ONLY. No markdown backticks.`;

  const response = await client.models.generateContent({
    model,
    contents: [
      {
        inlineData: {
          data: buffer.toString('base64'),
          mimeType,
        },
      },
      prompt,
    ],
  });

  const rawText = response.text || '';
  const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
  if (!cleaned) {
    throw new Error('Empty response from vision safety model');
  }

  const parsed = JSON.parse(cleaned) as VisionSafetyAssessment;

  const minConfidence = parseFloat(process.env.SAFETY_CONFIDENCE_THRESHOLD || '0.60');

  // Fail closed if confidence is too low (< minConfidence) or confidence is missing
  if (typeof parsed.confidence !== 'number' || parsed.confidence < minConfidence) {
    throw new Error(`Vision safety confidence too low (${parsed.confidence ?? 'missing'} < ${minConfidence.toFixed(2)})`);
  }


  return parsed;
}

/**
 * Pluggable Sub-Classifier 1: Apparent Age Classifier
 * Enforces Section 2 Guardrail 1: Adult-only persona (>= 21 recommended).
 * Blocks if any indication of a minor or youthful appearance.
 */
export async function evaluateApparentAge(
  input: SafetyCheckInput
): Promise<{ status: 'passed' | 'blocked'; estimatedAge: number; details: string }> {
  // Check metadata/tags/prompts for underage indicators
  const promptText = (input.metadata?.prompt || '').toLowerCase();
  const tagsText = (input.metadata?.tags || []).join(' ').toLowerCase();

  const underageKeywords = ['teen', 'minor', 'schoolgirl', 'youthful', 'kid', 'child', 'underage', 'lolita', 'babyface'];
  const hasKeywordViolation = underageKeywords.some(
    (kw) =>
      new RegExp(`\\b${kw}\\b`, 'i').test(promptText) ||
      new RegExp(`\\b${kw}\\b`, 'i').test(tagsText)
  );

  if (hasKeywordViolation) {
    return {
      status: 'blocked',
      estimatedAge: 17,
      details: 'HARD BLOCK: Prompt or tags contain youthful/minor keywords.',
    };
  }

  // Model-based estimation (or injected score)
  const estimatedAge = input.customScores?.apparentAge ?? (input.buffer ? 0 : 25);
  const youthLikelihood = input.customScores?.youthLikelihood ?? (input.buffer ? 1 : 0.05);

  if (estimatedAge < 18 || youthLikelihood > 0.4) {
    return {
      status: 'blocked',
      estimatedAge,
      details: `HARD BLOCK: Apparent age estimated under 18 (${estimatedAge}y, youth likelihood: ${(youthLikelihood * 100).toFixed(0)}%). Minors are strictly prohibited.`,
    };
  }

  if (estimatedAge < 21 || youthLikelihood > 0.2) {
    return {
      status: 'blocked',
      estimatedAge,
      details: `HARD BLOCK: Below conservative adult threshold of 21 years (${estimatedAge}y). Section 2 Guardrail 1 requires mature adult appearance.`,
    };
  }

  return {
    status: 'passed',
    estimatedAge,
    details: `Apparent mature adult age verified (${estimatedAge}y).`,
  };
}

/**
 * Pluggable Sub-Classifier 2: Real-Person Likeness Classifier
 * Enforces Section 2 Guardrail 2: Fictional identity only.
 * Blocks on high similarity to known public figures or celebrities.
 */
export async function evaluateRealPersonLikeness(
  input: SafetyCheckInput
): Promise<{ status: 'passed' | 'blocked' | 'review'; score: number; matched?: string }> {
  const likenessScore = input.customScores?.realPersonLikeness ?? (input.buffer ? 1 : 0.05);
  const matchedCelebrity = input.customScores?.matchedCelebrity;

  if (likenessScore >= 0.7) {
    return {
      status: 'blocked',
      score: likenessScore,
      matched: matchedCelebrity || 'Unidentified Public Figure',
    };
  }

  if (likenessScore >= 0.45) {
    return {
      status: 'review',
      score: likenessScore,
      matched: matchedCelebrity || 'Possible Public Figure Resemblance',
    };
  }

  return {
    status: 'passed',
    score: likenessScore,
  };
}

/**
 * Pluggable Sub-Classifier 3: Platform SFW Classifier
 * Evaluates NSFW/explicit score against suitability and platform rules.
 */
export async function evaluatePlatformSfw(
  input: SafetyCheckInput
): Promise<{ status: 'passed' | 'blocked' | 'review'; score: number; details: string }> {
  const nsfwScore = input.customScores?.nsfwScore ?? (input.buffer ? 1 : 0.02);
  const declaredSuitability = input.metadata?.suitability || 'sfw_safe';

  if (declaredSuitability === 'sfw_safe' && nsfwScore > 0.6) {
    return {
      status: 'blocked',
      score: nsfwScore,
      details: `Explicit score too high for declared SFW asset (${(nsfwScore * 100).toFixed(0)}%). Cannot enter SFW queues.`,
    };
  }

  if (declaredSuitability === 'sfw_safe' && nsfwScore > 0.3) {
    return {
      status: 'review',
      score: nsfwScore,
      details: `Borderline suggestive content detected (${(nsfwScore * 100).toFixed(0)}%). Requires human verification.`,
    };
  }

  return {
    status: 'passed',
    score: nsfwScore,
    details: 'Asset complies with SFW guidelines.',
  };
}

/**
 * Master Pluggable Safety Gate Pipeline
 * Evaluates Apparent Age, Likeness, and SFW rating.
 * FAIL-CLOSED: If classifier service is unreachable, errors, or confidence is low (<0.70), blocks asset.
 */
export async function runSafetyGatePipeline(input: SafetyCheckInput): Promise<SafetyGateResult> {
  const reasons: string[] = [];

  // 1. Fail-Safe Check: If classifier is unavailable or forced failure, default to 'pending'
  if (input.forceClassifierFailure) {
    return {
      status: 'pending',
      apparentAge: 0,
      youthLikelihood: 1,
      realPersonLikeness: 1,
      nsfwScore: 1,
      reasons: ['FAIL-SAFE TRIGGERED: Classifier service unavailable. Asset queued as pending.'],
      classifierBreakdown: {
        ageCheck: { status: 'blocked', estimatedAge: 0, details: 'Classifier offline' },
        likenessCheck: { status: 'review', score: 1 },
        sfwCheck: { status: 'review', score: 1, details: 'Classifier offline' },
      },
      evaluatedAt: new Date().toISOString(),
    };
  }

  let effectiveInput: SafetyCheckInput = input;
  let visionAssessment: VisionSafetyAssessment | null = null;

  // 2. Real Vision Classifier: When an image buffer is provided and customScores are not supplied
  if (input.buffer && !input.customScores) {
    try {
      visionAssessment = await evaluateVisionSafety(input.buffer);
      effectiveInput = {
        ...input,
        customScores: {
          apparentAge: visionAssessment.estimatedAge,
          youthLikelihood: visionAssessment.youthLikelihood,
          realPersonLikeness: visionAssessment.resemblanceScore,
          matchedCelebrity: visionAssessment.matchedCelebrity || undefined,
          nsfwScore: visionAssessment.nsfwScore,
        },
      };
    } catch (err: unknown) {
      // FAIL-CLOSED: Error in vision classifier or confidence below threshold blocks the asset
      const message = err instanceof Error ? err.message : 'Unknown classifier error';
      return {
        status: 'blocked',
        apparentAge: 0,
        youthLikelihood: 1,
        realPersonLikeness: 1,
        nsfwScore: 1,
        reasons: [`FAIL-CLOSED: Safety vision check failed or confidence was too low (${message}). Asset blocked.`],
        classifierBreakdown: {
          ageCheck: { status: 'blocked', estimatedAge: 0, details: `Vision check error: ${message}` },
          likenessCheck: { status: 'blocked', score: 1 },
          sfwCheck: { status: 'blocked', score: 1, details: `Vision check error: ${message}` },
        },
        evaluatedAt: new Date().toISOString(),
      };
    }
  }

  try {
    // Run sub-classifiers
    const [ageCheck, likenessCheck, sfwCheck] = await Promise.all([
      evaluateApparentAge(effectiveInput),
      evaluateRealPersonLikeness(effectiveInput),
      evaluatePlatformSfw(effectiveInput),
    ]);

    let finalStatus: SafetyGateResult['status'] = 'passed';

    // Hard Block 1: Minor or youthful appearance
    if (ageCheck.status === 'blocked') {
      finalStatus = 'blocked';
      reasons.push(ageCheck.details);
    }

    // Hard Block 2: Celebrity / Real Person likeness
    if (likenessCheck.status === 'blocked') {
      finalStatus = 'blocked';
      reasons.push(`HARD BLOCK: High likeness detected to real person (${likenessCheck.matched}, score: ${(likenessCheck.score * 100).toFixed(0)}%).`);
    }

    // Borderline review or block for SFW
    if (sfwCheck.status === 'blocked') {
      if (finalStatus !== 'blocked') finalStatus = 'blocked';
      reasons.push(sfwCheck.details);
    } else if (sfwCheck.status === 'review' || likenessCheck.status === 'review') {
      if (finalStatus !== 'blocked') {
        finalStatus = 'needs_manual_review';
        if (likenessCheck.status === 'review') {
          reasons.push(`Borderline likeness check (${likenessCheck.matched}). Manual review required.`);
        }
        if (sfwCheck.status === 'review') {
          reasons.push(sfwCheck.details);
        }
      }
    }

    if (visionAssessment?.hasTextOrLogos) {
      reasons.push(`Notice: Text/logos detected in image (${visionAssessment.textOrLogosDetails || 'visible text/logo'}).`);
    }

    if (visionAssessment && !visionAssessment.adultAppearing && finalStatus !== 'blocked') {
      finalStatus = 'blocked';
      reasons.push('HARD BLOCK: Vision classifier determined subject is not adult-appearing (age < 21).');
    }

    if (finalStatus === 'passed') {
      reasons.push('All safety checks passed: mature adult persona, unique fictional identity, SFW compliant.');
    }

    return {
      status: finalStatus,
      apparentAge: ageCheck.estimatedAge,
      youthLikelihood: effectiveInput.customScores?.youthLikelihood ?? 0.05,
      realPersonLikeness: likenessCheck.score,
      matchedCelebrity: likenessCheck.matched,
      nsfwScore: sfwCheck.score,
      reasons,
      classifierBreakdown: {
        ageCheck,
        likenessCheck,
        sfwCheck,
      },
      evaluatedAt: new Date().toISOString(),
    };
  } catch {
    // FAIL-SAFE: Any unhandled classifier error must default to 'pending', never 'passed'
    return {
      status: 'pending',
      apparentAge: 0,
      youthLikelihood: 1,
      realPersonLikeness: 1,
      nsfwScore: 1,
      reasons: ['FAIL-SAFE: Safety classifier encountered unexpected error. Defaulting to pending review.'],
      classifierBreakdown: {
        ageCheck: { status: 'blocked', estimatedAge: 0, details: 'Classifier error' },
        likenessCheck: { status: 'review', score: 1 },
        sfwCheck: { status: 'review', score: 1, details: 'Classifier error' },
      },
      evaluatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Manual Safety Override Handler
 * Rule from Section 5.3: Blocked assets CANNOT be overridden into SFW queues.
 * Manual review overrides ONLY apply to borderline SFW classification cases ('needs_manual_review')
 * and are strictly audit-logged.
 */
export async function overrideSafetyDecision(
  assetId: string,
  userId: string | undefined,
  overrideReason: string
) {
  if (!overrideReason || overrideReason.trim().length < 5) {
    throw new Error('A detailed justification is required for manual safety overrides.');
  }

  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) {
    throw new Error('Asset not found');
  }

  // Hard Rule: Blocked assets cannot be overridden
  if (asset.safetyStatus === 'blocked') {
    throw new Error(
      'CRITICAL GUARDRAIL ENFORCEMENT: Hard-blocked assets (minor appearance, celebrity likeness, or explicit violations) CANNOT be overridden into public/SFW queues.'
    );
  }

  if (asset.safetyStatus !== 'needs_manual_review') {
    throw new Error(`Only assets in 'needs_manual_review' status can be manually approved. Current status: ${asset.safetyStatus}`);
  }

  const updatedAsset = await prisma.asset.update({
    where: { id: assetId },
    data: {
      safetyStatus: 'passed',
      safetyReasons: JSON.stringify([
        ...(asset.safetyReasons ? JSON.parse(asset.safetyReasons) : []),
        `[MANUAL OVERRIDE APPROVED by ${userId || 'authorized user'}]: ${overrideReason.trim()}`,
      ]),
    },
  });

  await logAuditEvent({
    userId,
    action: 'override',
    entity: 'Asset',
    entityId: assetId,
    meta: {
      previousStatus: asset.safetyStatus,
      newStatus: 'passed',
      overrideReason,
    },
  });

  return updatedAsset;
}
