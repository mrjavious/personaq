import { describe, it, expect } from 'vitest';
import { FallbackTemplateProvider } from '@/lib/ai/fallback-template';
import { filterAiText, sanitizeCaptionOption } from '@/lib/ai/content-filter';
import { CompositeTextProvider } from '@/lib/ai';

describe('AI Caption Assistant & Provider Pipeline', () => {
  const samplePersona = {
    name: 'Aria Nova',
    adultAge: 26,
    backstory: 'Aria is a digital artist in Neo-Arcadia.',
    voiceTone: 'Thoughtful, curious, witty.',
    catchphrases: ['Pixels into imagination', 'Code meets beauty'],
    boundaries: ['Never simulate real grief', 'Strictly fictional identity'],
    contentPillars: ['Digital Art', 'Creative Workflows'],
    aiDisclosureText: '✨ Disclosed Fictional AI Persona: Created with generative AI tools.',
  };

  describe('Fallback Template & Composite Engine', () => {
    it('should generate 3 distinct options with tone, hashtags, alt-text, and disclosure', async () => {
      const provider = new FallbackTemplateProvider();
      const res = await provider.generateCaption({
        concept: 'Holographic fashion workflow in Neo-Arcadia',
        platform: 'instagram',
        persona: samplePersona,
      });

      expect(res.options).toHaveLength(3);
      expect(res.options[0].tone).toBe('Witty & Engaging');
      expect(res.options[1].tone).toBe('Thoughtful & Technical');
      expect(res.options[2].tone).toBe('Aesthetic & Minimal');

      // Verify each option includes hashtags and alt text
      res.options.forEach((opt) => {
        expect(opt.hashtags.length).toBeGreaterThan(0);
        expect(opt.altText).toBeDefined();
        expect(opt.caption).toContain('Holographic fashion workflow');
        // Verify mandatory disclosure is included
        expect(opt.caption).toContain(samplePersona.aiDisclosureText);
      });
    });

    it('should draft friendly, in-character replies for fan comments', async () => {
      const provider = new FallbackTemplateProvider();
      const res = await provider.draftReply({
        contextText: 'Love the lighting on this piece! What tool did you use?',
        platform: 'x',
        persona: samplePersona,
      });

      expect(res.suggestions.length).toBeGreaterThanOrEqual(2);
      expect(res.suggestions[0]).toBeDefined();
    });

    it('should run composite provider with seamless fallback', async () => {
      const composite = new CompositeTextProvider();
      const res = await composite.generateCaption({
        concept: 'Exploration of neural color grading',
        platform: 'threads',
        persona: samplePersona,
      });

      expect(res.options).toHaveLength(3);
      expect(res.platform).toBe('threads');
    });
  });

  describe('Content Safety Filter', () => {
    it('should flag explicit or forbidden words in AI output', () => {
      const check = filterAiText('This is a completely explicit nsfw photo shoot with nude elements');
      expect(check.passed).toBe(false);
      expect(check.violations.length).toBeGreaterThan(0);
    });

    it('should pass compliant SFW text', () => {
      const check = filterAiText('Here is the latest digital artwork exploring cyberpunk architecture');
      expect(check.passed).toBe(true);
      expect(check.violations).toHaveLength(0);
    });

    it('should automatically append AI disclosure if omitted by the model', () => {
      const sanitized = sanitizeCaptionOption(
        {
          tone: 'Witty',
          caption: 'Great day in the virtual studio compiling new ideas!',
          hashtags: ['#Art'],
          altText: 'Virtual studio',
          aiDisclosureIncluded: false,
        },
        samplePersona.aiDisclosureText,
        'instagram'
      );

      expect(sanitized.caption).toContain(samplePersona.aiDisclosureText);
      expect(sanitized.aiDisclosureIncluded).toBe(true);
    });
  });
});
