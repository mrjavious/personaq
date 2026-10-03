import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as session from '@/lib/auth/session';
import { GET } from '@/app/api/health/route';

vi.mock('@/lib/db/prisma', () => ({
  default: {
    user: { count: vi.fn().mockResolvedValue(2) },
    persona: { count: vi.fn().mockResolvedValue(1) },
    post: { count: vi.fn().mockResolvedValue(5) },
  },
}));

vi.mock('@/lib/logging', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('Health endpoint', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.GEMINI_API_KEY = 'test-gemini-key-valid';
  });

  it('returns strictly { status } for unauthenticated callers', async () => {
    vi.spyOn(session, 'getCurrentUser').mockResolvedValue(null);

    const req = new Request('http://localhost:3000/api/health');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('status');
    expect(['ok', 'degraded']).toContain(data.status);
    expect(Object.keys(data)).toEqual(['status']);
    expect(data.services).toBeUndefined();
    expect(data.counts).toBeUndefined();
    expect(data.uptime).toBeUndefined();
  });

  it('returns full sanitized report for authenticated callers without secrets or paths', async () => {
    vi.spyOn(session, 'getCurrentUser').mockResolvedValue({
      userId: 'user-admin',
      email: 'admin@example.com',
      role: 'admin',
      twoFactorAuthenticated: true,
    });

    process.env.REDIS_URL = 'redis://default:supersecretpassword123@redis.prod:6379';

    const req = new Request('http://localhost:3000/api/health');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.counts).toEqual({
      users: 2,
      personas: 1,
      posts: 5,
    });
    expect(data.services).toBeDefined();
    expect(data.services.database.status).toBe('healthy');
    expect(data.services.redis.status).toBe('healthy');

    const jsonString = JSON.stringify(data);
    expect(jsonString).not.toContain('supersecretpassword123');
    expect(jsonString).not.toContain('redis://');
    expect(jsonString).not.toContain(process.cwd());
  });
});
