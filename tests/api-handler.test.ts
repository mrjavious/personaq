import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withApi } from '@/lib/api/handler';
import { ApiError } from '@/lib/auth/guards';
import { z } from 'zod';
import * as guards from '@/lib/auth/guards';
import * as session from '@/lib/auth/session';
import { NextResponse } from 'next/server';

describe('withApi handler', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('maps ApiError 401 to status 401', async () => {
    vi.spyOn(guards, 'requireAuth').mockRejectedValue(new ApiError(401, 'Authentication required'));

    const handler = withApi(async () => {
      return NextResponse.json({ ok: true });
    });

    const req = new Request('http://localhost:3000/api/test');
    const res = await handler(req);

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Authentication required');
    expect(data.success).toBe(false);
  });

  it('maps ApiError 403 to status 403', async () => {
    vi.spyOn(guards, 'requirePermission').mockRejectedValue(
      new ApiError(403, 'Forbidden: Missing required permission')
    );

    const handler = withApi(
      async () => NextResponse.json({ ok: true }),
      { permission: 'manage_persona' }
    );

    const req = new Request('http://localhost:3000/api/test');
    const res = await handler(req);

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe('Forbidden: Missing required permission');
    expect(data.success).toBe(false);
  });

  it('maps ZodError to status 400 with validation details', async () => {
    vi.spyOn(guards, 'requireAuth').mockResolvedValue({
      userId: 'u1',
      email: 'test@example.com',
      role: 'editor',
      twoFactorAuthenticated: true,
    });

    const testSchema = z.object({
      name: z.string().min(3),
    });

    const handler = withApi(async (req) => {
      const body = await req.json();
      testSchema.parse(body);
      return NextResponse.json({ ok: true });
    });

    const req = new Request('http://localhost:3000/api/test', {
      method: 'POST',
      body: JSON.stringify({ name: 'a' }),
    });
    const res = await handler(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Invalid input');
    expect(data.details).toBeDefined();
    expect(data.success).toBe(false);
  });

  it('maps unhandled generic exceptions to status 500', async () => {
    vi.spyOn(guards, 'requireAuth').mockResolvedValue({
      userId: 'u1',
      email: 'test@example.com',
      role: 'owner',
      twoFactorAuthenticated: true,
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const handler = withApi(async () => {
      throw new Error('Database connection exploded');
    });

    const req = new Request('http://localhost:3000/api/test');
    const res = await handler(req);

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('Internal server error');
    expect(data.success).toBe(false);

    consoleSpy.mockRestore();
  });

  it('permits unauthenticated requests when public: true', async () => {
    vi.spyOn(session, 'getCurrentUser').mockResolvedValue(null);

    const handler = withApi(
      async (_req, context) => {
        return NextResponse.json({ publicUser: context.user });
      },
      { public: true }
    );

    const req = new Request('http://localhost:3000/api/public-test');
    const res = await handler(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.publicUser).toBeNull();
  });
});
