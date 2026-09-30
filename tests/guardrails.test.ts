import { describe, it, expect } from 'vitest';
import {
  validatePersonaGuardrails,
  validatePostVariantSuitability,
  validateAssetForScheduling,
  isPlatformRuleStale,
} from '@/lib/guardrails/rules';

describe('Non-Negotiable Guardrails (Section 2)', () => {
  describe('Guardrail 1 & 3: Adult-only Persona and Mandatory AI Disclosure', () => {
    it('should reject persona without adult age', () => {
      const res = validatePersonaGuardrails({
        adultAge: 0,
        aiDisclosureText: 'AI persona disclosure',
      });
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('Adult age is mandatory'))).toBe(true);
    });

    it('should reject persona with minor age (< 18)', () => {
      const res = validatePersonaGuardrails({
        adultAge: 17,
        aiDisclosureText: 'AI persona disclosure',
      });
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('Minors are strictly prohibited'))).toBe(true);
    });

    it('should warn if age is between 18 and 20', () => {
      const res = validatePersonaGuardrails({
        adultAge: 19,
        aiDisclosureText: 'AI persona disclosure',
      });
      expect(res.valid).toBe(true);
      expect(res.warnings?.length).toBeGreaterThan(0);
      expect(res.warnings?.[0]).toContain('21+');
    });

    it('should reject persona without mandatory AI disclosure text', () => {
      const res = validatePersonaGuardrails({
        adultAge: 26,
        aiDisclosureText: '',
      });
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('AI disclosure text is mandatory'))).toBe(true);
    });

    it('should accept valid adult persona with AI disclosure', () => {
      const res = validatePersonaGuardrails({
        adultAge: 27,
        aiDisclosureText: 'This is a fictional AI-generated persona managed by Persona Studio.',
      });
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });
  });

  describe('Guardrail 4: Asset Class Separation', () => {
    const sfwPlatforms = ['instagram', 'x', 'threads', 'tiktok'];

    sfwPlatforms.forEach((platform) => {
      it(`should strictly block adult_only asset from targeting ${platform}`, () => {
        const res = validatePostVariantSuitability(platform, 'adult_only');
        expect(res.valid).toBe(false);
        expect(res.errors[0]).toContain('CRITICAL GUARDRAIL VIOLATION');
      });

      it(`should allow sfw_safe asset on ${platform}`, () => {
        const res = validatePostVariantSuitability(platform, 'sfw_safe');
        expect(res.valid).toBe(true);
      });
    });

    it('should allow adult_only asset on monetization platform (Fanvue)', () => {
      const res = validatePostVariantSuitability('fanvue', 'adult_only');
      expect(res.valid).toBe(true);
    });
  });

  describe('Guardrail 5.3: Safety Gate eligibility', () => {
    it('should reject scheduling when safety status is pending', () => {
      const res = validateAssetForScheduling({
        safetyStatus: 'pending',
        suitability: 'sfw_safe',
        targetPlatform: 'instagram',
      });
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain('Safety gate status is \'pending\'');
    });

    it('should reject scheduling when safety status is blocked', () => {
      const res = validateAssetForScheduling({
        safetyStatus: 'blocked',
        suitability: 'sfw_safe',
        targetPlatform: 'x',
      });
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain('Safety gate status is \'blocked\'');
    });

    it('should pass scheduling only when safety status is passed and suitability matches', () => {
      const res = validateAssetForScheduling({
        safetyStatus: 'passed',
        suitability: 'sfw_safe',
        targetPlatform: 'threads',
      });
      expect(res.valid).toBe(true);
    });
  });

  describe('Guardrail 9: Platform Rule staleness check', () => {
    it('should detect stale rules older than 90 days', () => {
      const hundredDaysAgo = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
      expect(isPlatformRuleStale(hundredDaysAgo)).toBe(true);
    });

    it('should accept verified rules within 90 days', () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      expect(isPlatformRuleStale(thirtyDaysAgo)).toBe(false);
    });
  });
});
