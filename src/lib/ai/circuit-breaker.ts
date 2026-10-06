type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxAttempts: number;
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  resetTimeoutMs: 60_000,
  halfOpenMaxAttempts: 3,
};

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private successes = 0;
  private nextAttempt = 0;
  private readonly options: CircuitBreakerOptions;

  constructor(
    private readonly name: string,
    options: Partial<CircuitBreakerOptions> = {},
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() < this.nextAttempt) {
        throw new Error(`Circuit breaker '${this.name}' is OPEN. Try again later.`);
      }
      this.state = 'half-open';
      this.successes = 0;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;

    if (this.state === 'half-open') {
      this.successes++;
      if (this.successes >= this.options.halfOpenMaxAttempts) {
        this.state = 'closed';
        this.successes = 0;
      }
    }
  }

  private onFailure(): void {
    this.failures++;

    if (this.state === 'half-open') {
      this.state = 'open';
      this.nextAttempt = Date.now() + this.options.resetTimeoutMs;
      return;
    }

    if (this.failures >= this.options.failureThreshold) {
      this.state = 'open';
      this.nextAttempt = Date.now() + this.options.resetTimeoutMs;
      console.warn(`Circuit breaker '${this.name}' opened after ${this.failures} failures`);
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}

// Shared circuit breakers for external AI providers
export const groqCircuitBreaker = new CircuitBreaker('groq', {
  failureThreshold: 3,
  resetTimeoutMs: 30_000,
});

export const openaiCompatCircuitBreaker = new CircuitBreaker('openai-compat', {
  failureThreshold: 3,
  resetTimeoutMs: 30_000,
});

export const ollamaCircuitBreaker = new CircuitBreaker('ollama', {
  failureThreshold: 3,
  resetTimeoutMs: 30_000,
});
