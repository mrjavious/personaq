import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getAggregatedAnalytics,
  generateAiAnalyticsSummary,
  exportAnalyticsCsv,
  importAnalyticsCsv,
} from '@/lib/analytics/service';
import { prisma } from '@/lib/db';

describe('Phase 5: Funnel Analytics & Insights Service', () => {
  describe('getAggregatedAnalytics', () => {
    it('aggregates platform accounts and computes funnel CTR and Fanvue conversion rate', async () => {
      const result = await getAggregatedAnalytics(30);

      expect(result).toBeDefined();
      expect(result.totals).toBeDefined();
      expect(result.totals.followers).toBeGreaterThanOrEqual(0);
      expect(result.totals.impressions).toBeGreaterThanOrEqual(0);
      expect(result.funnel).toBeDefined();
      expect(result.funnel.hubCtr).toBeGreaterThanOrEqual(0);
      expect(result.funnel.fanvueConversionRate).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.platforms)).toBe(true);
      expect(Array.isArray(result.topPosts)).toBe(true);
    });
  });

  describe('CSV Export and Import', () => {
    it('generates a CSV header and valid string formatting', async () => {
      const csv = await exportAnalyticsCsv();
      expect(typeof csv).toBe('string');
      expect(csv).toContain('Platform,Handle,Date,Followers,Impressions,Engagement,Clicks');
    });

    it('rejects empty or single-line CSV data', async () => {
      await expect(importAnalyticsCsv('Header Only\n')).rejects.toThrow(
        'CSV file must have a header row and at least one data row'
      );
    });

    it('successfully parses and creates snapshots from valid CSV rows', async () => {
      const sampleCsv = `Platform,Handle,Date,Followers,Impressions,Engagement,Clicks
instagram,@aria.nova.ai,2026-09-28,15400,72000,3200,600
x,@arianova_ai,2026-09-28,9500,45000,1900,420`;

      const result = await importAnalyticsCsv(sampleCsv);
      expect(result.importedCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('generateAiAnalyticsSummary', () => {
    it('generates strategic recommendations with date range via TextProvider fallback', async () => {
      const summary = await generateAiAnalyticsSummary(7);
      expect(typeof summary).toBe('string');
      expect(summary.length).toBeGreaterThan(20);
    });
  });
});
