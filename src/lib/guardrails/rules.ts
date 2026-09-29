/**
 * Section 2: Non-Negotiable Guardrails
 * Enforced in code across services and API routes.
 */

export const SFW_PLATFORMS = ['instagram', 'x', 'threads', 'tiktok'] as const;
export type SfwPlatform = (typeof SFW_PLATFORMS)[number];

export const ALL_PLATFORMS = ['instagram', 'x', 'threads', 'tiktok', 'fanvue'] as const;
export type Platform = (typeof ALL_PLATFORMS)[number];

export const MINIMUM_ADULT_AGE = 18;
export const RECOMMENDED_ADULT_AGE = 25;

export interface GuardrailValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Guardrail 1 & 3: Validate Persona input.
 * - Adult-only persona required (>= 25 recommended, >= 18 strict minimum).
 * - Mandatory AI disclosure text.
 */
export function validatePersonaGuardrails(input: {
  adultAge: number;
  aiDisclosureText?: string | null;
  name?: string;
}): GuardrailValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!input.adultAge || typeof input.adultAge !== 'number') {
    errors.push('Adult age is mandatory for persona creation.');
  } else if (input.adultAge < MINIMUM_ADULT_AGE) {
    errors.push(`Persona must be an adult (age >= ${MINIMUM_ADULT_AGE}). Minors are strictly prohibited.`);
  } else if (input.adultAge < RECOMMENDED_ADULT_AGE) {
    warnings.push(
      `Age ${input.adultAge} is below conservative recommended default (${RECOMMENDED_ADULT_AGE}+). Ensure persona is clearly mature.`
    );
  }

  if (!input.aiDisclosureText || input.aiDisclosureText.trim().length === 0) {
    errors.push('AI disclosure text is mandatory on every persona profile.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Guardrail 4: Asset class separation.
 * 'adult_only' assets can NEVER be attached to posts targeting Instagram, X (public), Threads, or TikTok.
 */
export function validatePostVariantSuitability(
  platform: string,
  assetSuitability?: string | null
): GuardrailValidationResult {
  const errors: string[] = [];
  const normalizedPlatform = platform.toLowerCase();

  const isSfwPlatform = SFW_PLATFORMS.includes(normalizedPlatform as SfwPlatform);

  if (isSfwPlatform && assetSuitability === 'adult_only') {
    errors.push(
      `CRITICAL GUARDRAIL VIOLATION: 'adult_only' asset cannot be scheduled or published to SFW platform '${platform}'. Target platform must be 18+ monetization only (e.g. Fanvue).`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Guardrail 1 & 2 & 5.3: Safety Gate eligibility.
 * Any asset flagged as minor/youthful or blocked must not enter any queue.
 */
export function validateAssetForScheduling(asset: {
  safetyStatus: string;
  suitability: string;
  targetPlatform: string;
}): GuardrailValidationResult {
  const errors: string[] = [];

  if (asset.safetyStatus !== 'passed') {
    errors.push(
      `Asset cannot be scheduled: Safety gate status is '${asset.safetyStatus}'. Asset must pass safety classifier before entering any queue.`
    );
  }

  const suitabilityCheck = validatePostVariantSuitability(asset.targetPlatform, asset.suitability);
  if (!suitabilityCheck.valid) {
    errors.push(...suitabilityCheck.errors);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Guardrail 9: Platform Rule staleness check.
 * Warn if platform rules have not been verified in over 90 days.
 */
export function isPlatformRuleStale(lastVerifiedAt: Date | string | null): boolean {
  if (!lastVerifiedAt) return true;
  const verifiedDate = new Date(lastVerifiedAt).getTime();
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
  return Date.now() - verifiedDate > ninetyDaysMs;
}
