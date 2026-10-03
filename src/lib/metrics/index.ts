// Simple in-memory metrics collection
// In production, use Prometheus, Datadog, or StatsD

export interface MetricEntry {
  name: string;
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

interface Counter {
  name: string;
  value: number;
  labels?: Record<string, string>;
}

interface Histogram {
  name: string;
  values: number[];
  labels?: Record<string, string>;
}

class MetricsCollector {
  private counters = new Map<string, Counter>();
  private histograms = new Map<string, Histogram>();
  private gauges = new Map<string, number>();

  // Counter: monotonically increasing value
  incrementCounter(name: string, value = 1, labels?: Record<string, string>) {
    const key = this.getMetricKey(name, labels);
    const existing = this.counters.get(key);
    if (existing) {
      existing.value += value;
    } else {
      this.counters.set(key, { name, value, labels });
    }
  }

  // Gauge: value that can go up or down
  setGauge(name: string, value: number, labels?: Record<string, string>) {
    const key = this.getMetricKey(name, labels);
    this.gauges.set(key, value);
  }

  // Histogram: distribution of values
  recordHistogram(name: string, value: number, labels?: Record<string, string>) {
    const key = this.getMetricKey(name, labels);
    const existing = this.histograms.get(key);
    if (existing) {
      existing.values.push(value);
    } else {
      this.histograms.set(key, { name, values: [value], labels });
    }
  }

  // Get all metrics
  getMetrics() {
    return {
      counters: Array.from(this.counters.values()),
      gauges: Array.from(this.gauges.entries()).map(([key, value]) => ({
        name: key,
        value,
      })),
      histograms: Array.from(this.histograms.values()).map((h) => ({
        name: h.name,
        count: h.values.length,
        min: Math.min(...h.values),
        max: Math.max(...h.values),
        avg: h.values.reduce((a, b) => a + b, 0) / h.values.length,
        p50: this.percentile(h.values, 50),
        p95: this.percentile(h.values, 95),
        p99: this.percentile(h.values, 99),
      })),
    };
  }

  // Reset all metrics
  reset() {
    this.counters.clear();
    this.histograms.clear();
    this.gauges.clear();
  }

  private getMetricKey(name: string, labels?: Record<string, string>): string {
    if (!labels) return name;
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return `${name}{${labelStr}}`;
  }

  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }
}

export const metrics = new MetricsCollector();

// Convenience functions
export function incrementCounter(name: string, value = 1, labels?: Record<string, string>) {
  metrics.incrementCounter(name, value, labels);
}

export function setGauge(name: string, value: number, labels?: Record<string, string>) {
  metrics.setGauge(name, value, labels);
}

export function recordHistogram(name: string, value: number, labels?: Record<string, string>) {
  metrics.recordHistogram(name, value, labels);
}

// Common metrics
export function recordApiRequest(method: string, path: string, status: number, durationMs: number) {
  incrementCounter('api_requests_total', 1, { method, path, status: String(status) });
  recordHistogram('api_request_duration_ms', durationMs, { method, path });
}

export function recordPublishAttempt(platform: string, success: boolean) {
  incrementCounter('publish_attempts_total', 1, { platform, success: String(success) });
}

export function recordSafetyCheck(status: string) {
  incrementCounter('safety_checks_total', 1, { status });
}
