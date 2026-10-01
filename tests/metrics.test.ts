import { describe, it, expect, beforeEach } from 'vitest';
import { metrics, incrementCounter, setGauge, recordHistogram, recordApiRequest, recordPublishAttempt, recordSafetyCheck } from '@/lib/metrics';

describe('metrics', () => {
  beforeEach(() => {
    metrics.reset();
  });

  describe('incrementCounter', () => {
    it('increments a counter', () => {
      incrementCounter('test_counter', 1);
      const allMetrics = metrics.getMetrics();
      expect(allMetrics.counters).toHaveLength(1);
      expect(allMetrics.counters[0].name).toBe('test_counter');
      expect(allMetrics.counters[0].value).toBe(1);
    });

    it('accumulates counter values', () => {
      incrementCounter('test_counter', 1);
      incrementCounter('test_counter', 2);
      const allMetrics = metrics.getMetrics();
      expect(allMetrics.counters[0].value).toBe(3);
    });

    it('tracks counters with labels separately', () => {
      incrementCounter('api_requests', 1, { method: 'GET' });
      incrementCounter('api_requests', 1, { method: 'POST' });
      const allMetrics = metrics.getMetrics();
      expect(allMetrics.counters).toHaveLength(2);
    });
  });

  describe('setGauge', () => {
    it('sets a gauge value', () => {
      setGauge('memory_usage', 1024);
      const allMetrics = metrics.getMetrics();
      expect(allMetrics.gauges).toHaveLength(1);
      expect(allMetrics.gauges[0].name).toContain('memory_usage');
      expect(allMetrics.gauges[0].value).toBe(1024);
    });

    it('updates gauge value', () => {
      setGauge('memory_usage', 1024);
      setGauge('memory_usage', 2048);
      const allMetrics = metrics.getMetrics();
      expect(allMetrics.gauges[0].value).toBe(2048);
    });
  });

  describe('recordHistogram', () => {
    it('records histogram values', () => {
      recordHistogram('response_time', 100);
      recordHistogram('response_time', 200);
      recordHistogram('response_time', 300);
      const allMetrics = metrics.getMetrics();
      expect(allMetrics.histograms).toHaveLength(1);
      expect(allMetrics.histograms[0].count).toBe(3);
      expect(allMetrics.histograms[0].min).toBe(100);
      expect(allMetrics.histograms[0].max).toBe(300);
      expect(allMetrics.histograms[0].avg).toBe(200);
    });

    it('calculates percentiles', () => {
      for (let i = 1; i <= 100; i++) {
        recordHistogram('response_time', i);
      }
      const allMetrics = metrics.getMetrics();
      expect(allMetrics.histograms[0].p50).toBe(50);
      expect(allMetrics.histograms[0].p95).toBe(95);
      expect(allMetrics.histograms[0].p99).toBe(99);
    });
  });

  describe('convenience functions', () => {
    it('recordApiRequest increments counter and records histogram', () => {
      recordApiRequest('GET', '/api/persona', 200, 150);
      const allMetrics = metrics.getMetrics();
      expect(allMetrics.counters.length).toBeGreaterThan(0);
      expect(allMetrics.histograms.length).toBeGreaterThan(0);
    });

    it('recordPublishAttempt increments counter', () => {
      recordPublishAttempt('instagram', true);
      const allMetrics = metrics.getMetrics();
      expect(allMetrics.counters.length).toBeGreaterThan(0);
    });

    it('recordSafetyCheck increments counter', () => {
      recordSafetyCheck('passed');
      const allMetrics = metrics.getMetrics();
      expect(allMetrics.counters.length).toBeGreaterThan(0);
    });
  });

  describe('reset', () => {
    it('clears all metrics', () => {
      incrementCounter('test', 1);
      setGauge('test', 100);
      recordHistogram('test', 50);
      metrics.reset();
      const allMetrics = metrics.getMetrics();
      expect(allMetrics.counters).toHaveLength(0);
      expect(allMetrics.gauges).toHaveLength(0);
      expect(allMetrics.histograms).toHaveLength(0);
    });
  });
});
