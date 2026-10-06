import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getDemographicAgeEstimate,
  getPersonaColorPalette,
  extractArticleMarkdown,
  generatePollinationsText,
} from '@/lib/free-apis';

describe('Public Free APIs Service (GetFreeAPIs.com)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Agify.io Demographic Age Inference', () => {
    it('returns suggested adult age (>= 18) from persona name', async () => {
      const globalFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: 'Maya', age: 26, count: 45200 }),
      } as Response);

      const result = await getDemographicAgeEstimate('Maya Lin');

      expect(globalFetch).toHaveBeenCalled();
      expect(result.suggestedAge).toBe(26);
      expect(result.source).toBe('agify.io');
    });

    it('clamps age to minimum adult age (18) if API returns lower', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: 'Timmy', age: 12, count: 9800 }),
      } as Response);

      const result = await getDemographicAgeEstimate('Timmy');
      expect(result.suggestedAge).toBe(18); // Non-negotiable adult guardrail
    });

    it('falls back cleanly if API is unreachable', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

      const result = await getDemographicAgeEstimate('Kaelen');
      expect(result.suggestedAge).toBe(24);
      expect(result.source).toBe('local_fallback');
    });
  });

  describe('2. The Color API Palette Generator', () => {
    it('fetches coordinated palette from seed hex', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          colors: [
            { hex: { value: '#38bdf8' }, name: { value: 'Sky Blue' }, rgb: { value: 'rgb(56, 189, 248)' } },
            { hex: { value: '#818cf8' }, name: { value: 'Indigo' }, rgb: { value: 'rgb(129, 140, 248)' } },
            { hex: { value: '#c084fc' }, name: { value: 'Purple' }, rgb: { value: 'rgb(192, 132, 252)' } },
          ],
        }),
      } as Response);

      const palette = await getPersonaColorPalette('38bdf8');
      expect(palette.primary).toBe('#38bdf8');
      expect(palette.colors.length).toBeGreaterThanOrEqual(3);
      expect(palette.source).toBe('thecolorapi.com');
    });

    it('returns default palette on network error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Offline'));

      const palette = await getPersonaColorPalette('ff0000');
      expect(palette.primary).toBe('#38bdf8');
      expect(palette.source).toBe('local_fallback');
    });
  });

  describe('3. Jina AI Article Reader', () => {
    it('extracts markdown text from url', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        text: async () => '# Article Title\n\nArticle content here.',
      } as Response);

      const content = await extractArticleMarkdown('https://example.com/blog');
      expect(content).toContain('# Article Title');
    });

    it('rejects invalid URLs cleanly', async () => {
      await expect(extractArticleMarkdown('not-a-url')).rejects.toThrow('Valid HTTP/HTTPS URL required');
    });
  });

  describe('4. Pollinations Text Generator', () => {
    it('returns text response from public endpoint', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        text: async () => 'Creative persona concept prompt response',
      } as Response);

      const text = await generatePollinationsText('Give me a theme');
      expect(text).toBe('Creative persona concept prompt response');
    });
  });
});
