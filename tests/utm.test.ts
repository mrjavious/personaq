import { describe, it, expect } from 'vitest';
import {
  buildUtmUrl,
  parseUtmParams,
  shouldHonorPrivacy,
} from '@/lib/links/utm';

describe('UTM Link Builder & Privacy Tracking', () => {
  describe('buildUtmUrl', () => {
    it('constructs a UTM-tagged URL from a clean base URL', () => {
      const url = buildUtmUrl('https://personaq.local/l/aria', {
        utm_source: 'instagram',
        utm_medium: 'bio_link',
        utm_campaign: 'cyber_launch',
        utm_content: 'post_01',
      });

      expect(url).toContain('https://personaq.local/l/aria?');
      expect(url).toContain('utm_source=instagram');
      expect(url).toContain('utm_medium=bio_link');
      expect(url).toContain('utm_campaign=cyber_launch');
      expect(url).toContain('utm_content=post_01');
    });

    it('preserves existing query parameters when adding UTM tags', () => {
      const url = buildUtmUrl('https://fanvue.com/arianova?tier=vip', {
        utm_source: 'x',
        utm_medium: 'post_caption',
      });

      expect(url).toContain('tier=vip');
      expect(url).toContain('utm_source=x');
      expect(url).toContain('utm_medium=post_caption');
    });

    it('supports relative paths cleanly', () => {
      const url = buildUtmUrl('/l/aria', {
        utm_source: 'threads',
        utm_campaign: 'summer_drop',
      });

      expect(url.startsWith('/l/aria?')).toBe(true);
      expect(url).toContain('utm_source=threads');
      expect(url).toContain('utm_campaign=summer_drop');
    });

    it('throws when base URL is empty or invalid', () => {
      expect(() => buildUtmUrl('', { utm_source: 'test' })).toThrow('Base URL cannot be empty');
    });
  });

  describe('parseUtmParams', () => {
    it('extracts all UTM parameters from a URL', () => {
      const testUrl = 'https://personaq.local/l/aria?utm_source=tiktok&utm_campaign=viral_01&utm_content=vid_3&utm_medium=bio_link';
      const params = parseUtmParams(testUrl);

      expect(params.utm_source).toBe('tiktok');
      expect(params.utm_campaign).toBe('viral_01');
      expect(params.utm_content).toBe('vid_3');
      expect(params.utm_medium).toBe('bio_link');
    });

    it('returns empty object when no UTM parameters are present', () => {
      const params = parseUtmParams('https://personaq.local/l/aria');
      expect(params.utm_source).toBeUndefined();
      expect(params.utm_campaign).toBeUndefined();
    });
  });

  describe('shouldHonorPrivacy (DNT & GPC)', () => {
    it('detects Do Not Track (DNT: 1)', () => {
      const headers = new Headers();
      headers.set('dnt', '1');
      expect(shouldHonorPrivacy(headers)).toBe(true);
    });

    it('detects Global Privacy Control (Sec-GPC: 1)', () => {
      const headers = new Headers();
      headers.set('sec-gpc', '1');
      expect(shouldHonorPrivacy(headers)).toBe(true);
    });

    it('returns false for standard headers without privacy signals', () => {
      const headers = new Headers();
      headers.set('user-agent', 'Mozilla/5.0');
      expect(shouldHonorPrivacy(headers)).toBe(false);
    });
  });

  describe('Privacy-Preserving Click Recording & Aggregated Metrics', () => {
    it('scrubs referrer when DNT or GPC is active and computes aggregated metrics', async () => {
      const { prisma } = await import('@/lib/db');
      const { recordPrivacyClickEvent, getAggregatedClickMetrics } = await import('@/lib/links/utm');

      let persona = await prisma.persona.findFirst();
      if (!persona) {
        persona = await prisma.persona.create({
          data: {
            name: 'UTM Test Persona',
            adultAge: 22,
            aiDisclosureText: 'Disclosed AI Creator',
            voiceTone: 'Witty',
            backstory: 'Testing persona',
            appearanceNotes: 'Blue hair, creative aesthetic',
          },
        });
      }

      const testSlug = `privacy-test-${Date.now()}`;
      const link = await prisma.linkHub.create({
        data: {
          personaId: persona.id,
          slug: testSlug,
          destinationUrl: 'https://fanvue.com/testpersona',
          isNeutralLanding: true,
        },
      });

      // 1. Standard click without privacy header
      const standardClick = await recordPrivacyClickEvent({
        linkId: link.id,
        utmSource: 'instagram',
        utmCampaign: 'promo',
        referrer: 'https://instagram.com/p/12345',
      });
      expect(standardClick.referrer).toBe('https://instagram.com/p/12345');

      // 2. Privacy-protected click with DNT: 1
      const privacyHeaders = new Headers();
      privacyHeaders.set('dnt', '1');
      const dntClick = await recordPrivacyClickEvent({
        linkId: link.id,
        utmSource: 'tiktok',
        utmCampaign: 'viral',
        referrer: 'https://tiktok.com/@creator/video/98765?tracking=secret',
        headers: privacyHeaders,
      });

      // Referrer must be stripped to protocol + domain only!
      expect(dntClick.referrer).toBe('https://tiktok.com');

      // 3. Compute aggregated metrics
      const metrics = await getAggregatedClickMetrics(link.id);
      expect(metrics.totalClicks).toBeGreaterThanOrEqual(2);
      expect(metrics.clicksBySource['instagram']).toBeGreaterThanOrEqual(1);
      expect(metrics.clicksBySource['tiktok']).toBeGreaterThanOrEqual(1);
      expect(metrics.clicksByCampaign['promo']).toBeGreaterThanOrEqual(1);
    });
  });
});

