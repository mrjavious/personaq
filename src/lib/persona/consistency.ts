import { GoogleGenAI } from '@google/genai';
import { recordUsage } from '@/lib/ai/budget';

export interface ConsistencyResult {
  score: number;
  reasons: string[];
  passed: boolean;
  status: 'consistent' | 'drifted — regenerate';
  minThreshold: number;
}

export interface ConsistencyAttempt {
  attempt: number;
  score: number;
  reasons: string[];
  passed: boolean;
  status: 'consistent' | 'drifted — regenerate';
  timestamp: string;
}

export interface ConsistencyProvenance {
  score: number;
  reasons: string[];
  passed: boolean;
  status: 'consistent' | 'drifted — regenerate';
  minThreshold: number;
  attempts: ConsistencyAttempt[];
}

export function getMinConsistency(): number {
  const envVal = process.env.CONSISTENCY_MIN;
  if (!envVal) return 70;
  const parsed = parseInt(envVal, 10);
  return isNaN(parsed) ? 70 : parsed;
}

export async function evaluateConsistency(
  lockedFaceBuffer: Buffer,
  newImageBuffer: Buffer,
  options?: { personaId?: string }
): Promise<ConsistencyResult> {
  const minThreshold = getMinConsistency();
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      score: 0,
      reasons: ['Gemini API key not configured for consistency verification'],
      passed: false,
      status: 'drifted — regenerate',
      minThreshold,
    };
  }

  try {
    const client = new GoogleGenAI({ apiKey });
    const model = process.env.GEMINI_VISION_MODEL || 'gemini-2.5-flash';

    const prompt = `You are an automated biometric facial consistency auditor for synthetic AI personas.
You are given two images:
- Image 1 is the canonical locked reference face card for this character.
- Image 2 is a new candidate generation of the same character.

Task:
Compare the facial features, bone structure, eye shape, nose shape, lip shape, jaw contour, and distinctive landmarks between Image 1 and Image 2.
Ignore differences in camera perspective, background, outfit, lighting, and expressions.
Determine whether Image 2 represents the EXACT SAME person as Image 1.

Return ONLY a valid JSON object with the following schema, and no other text or markdown formatting:
{
  "score": <integer from 0 to 100, where 100 means identical facial identity, and 0 means completely different person>,
  "reasons": [<string array with 1-4 specific anatomical comparison reasons>]
}`;

    const contents = [
      prompt,
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: lockedFaceBuffer.toString('base64'),
        },
      },
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: newImageBuffer.toString('base64'),
        },
      },
    ];

    const response = await client.models.generateContent({
      model,
      contents,
    });

    // Record ledger usage for consistency check
    await recordUsage({
      provider: 'gemini',
      model,
      kind: 'consistency',
      estimatedCost: 0.005,
      personaId: options?.personaId,
    }).catch((err) => {
      console.warn('Failed to record consistency usage ledger:', err);
    });

    const rawText = response.text || '';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        score: 0,
        reasons: ['Model did not return structured JSON consistency response'],
        passed: false,
        status: 'drifted — regenerate',
        minThreshold,
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const score = typeof parsed.score === 'number' ? Math.max(0, Math.min(100, Math.round(parsed.score))) : 0;
    const reasons = Array.isArray(parsed.reasons) ? parsed.reasons.map(String) : [];

    const passed = score >= minThreshold;

    return {
      score,
      reasons,
      passed,
      status: passed ? 'consistent' : 'drifted — regenerate',
      minThreshold,
    };
  } catch (err) {
    console.error('Error evaluating facial consistency:', err);
    return {
      score: 0,
      reasons: [`Consistency evaluation exception: ${(err as Error)?.message || 'Unknown error'}`],
      passed: false,
      status: 'drifted — regenerate',
      minThreshold,
    };
  }
}

export async function evaluateGenerationWithRetry(
  lockedFaceBuffer: Buffer,
  generateFn: (attempt: number) => Promise<{ buffer: Buffer; mimeType?: string }>,
  options?: { personaId?: string }
): Promise<{
  buffer: Buffer;
  mimeType: string;
  consistency: ConsistencyProvenance;
  assetSafetyOverride?: 'needs_manual_review' | null;
}> {
  const attempts: ConsistencyAttempt[] = [];

  // Attempt 1
  const gen1 = await generateFn(1);
  const eval1 = await evaluateConsistency(lockedFaceBuffer, gen1.buffer, options);

  attempts.push({
    attempt: 1,
    score: eval1.score,
    reasons: eval1.reasons,
    passed: eval1.passed,
    status: eval1.status,
    timestamp: new Date().toISOString(),
  });

  if (eval1.passed) {
    return {
      buffer: gen1.buffer,
      mimeType: gen1.mimeType || 'image/jpeg',
      consistency: {
        score: eval1.score,
        reasons: eval1.reasons,
        passed: true,
        status: 'consistent',
        minThreshold: eval1.minThreshold,
        attempts,
      },
      assetSafetyOverride: null,
    };
  }

  // Attempt 2 (at most one auto-retry)
  const gen2 = await generateFn(2);
  const eval2 = await evaluateConsistency(lockedFaceBuffer, gen2.buffer, options);

  attempts.push({
    attempt: 2,
    score: eval2.score,
    reasons: eval2.reasons,
    passed: eval2.passed,
    status: eval2.status,
    timestamp: new Date().toISOString(),
  });

  // Choose the best generation (prefer passing, else higher score)
  const bestGen = eval2.score >= eval1.score ? gen2 : gen1;
  const bestEval = eval2.score >= eval1.score ? eval2 : eval1;

  const passed = bestEval.passed;

  return {
    buffer: bestGen.buffer,
    mimeType: bestGen.mimeType || 'image/jpeg',
    consistency: {
      score: bestEval.score,
      reasons: bestEval.reasons,
      passed,
      status: passed ? 'consistent' : 'drifted — regenerate',
      minThreshold: bestEval.minThreshold,
      attempts,
    },
    assetSafetyOverride: passed ? null : 'needs_manual_review',
  };
}
