import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CircuitBreaker } from '@/lib/ai/circuit-breaker';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker('test', {
      failureThreshold: 3,
      resetTimeoutMs: 1000,
      halfOpenMaxAttempts: 2,
    });
  });

  it('starts in closed state', () => {
    expect(breaker.getState()).toBe('closed');
  });

  it('executes function successfully when closed', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await breaker.execute(fn);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(breaker.getState()).toBe('closed');
  });

  it('opens after reaching failure threshold', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    // First 2 failures - still closed
    await expect(breaker.execute(fn)).rejects.toThrow('fail');
    await expect(breaker.execute(fn)).rejects.toThrow('fail');
    expect(breaker.getState()).toBe('closed');

    // 3rd failure - opens circuit
    await expect(breaker.execute(fn)).rejects.toThrow('fail');
    expect(breaker.getState()).toBe('open');
  });

  it('rejects requests when circuit is open', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    // Open the circuit
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(fn)).rejects.toThrow('fail');
    }
    expect(breaker.getState()).toBe('open');

    // Next request should be rejected without calling fn
    const callCount = fn.mock.calls.length;
    await expect(breaker.execute(fn)).rejects.toThrow('OPEN');
    expect(fn).toHaveBeenCalledTimes(callCount); // fn not called
  });

  it('transitions to half-open after reset timeout', async () => {
    vi.useFakeTimers();

    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    // Open the circuit
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(fn)).rejects.toThrow('fail');
    }
    expect(breaker.getState()).toBe('open');

    // Advance time past reset timeout
    vi.advanceTimersByTime(1100);

    // Should be in half-open state now
    fn.mockResolvedValue('success');
    const result = await breaker.execute(fn);
    expect(result).toBe('success');
  });

  it('closes circuit after successful half-open attempts', async () => {
    vi.useFakeTimers();

    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    // Open the circuit
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(fn)).rejects.toThrow('fail');
    }

    // Advance time past reset timeout
    vi.advanceTimersByTime(1100);

    // Succeed twice to close
    fn.mockResolvedValue('success');
    await breaker.execute(fn);
    await breaker.execute(fn);
    expect(breaker.getState()).toBe('closed');
  });

  it('reopens circuit on failure in half-open state', async () => {
    vi.useFakeTimers();

    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    // Open the circuit
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(fn)).rejects.toThrow('fail');
    }

    // Advance time past reset timeout
    vi.advanceTimersByTime(1100);

    // Fail in half-open state
    await expect(breaker.execute(fn)).rejects.toThrow('fail');
    expect(breaker.getState()).toBe('open');
  });
});
