import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, Server } from 'http';
import { parse } from 'url';
import next from 'next';

/**
 * Integration tests for API routes.
 * These tests verify that the API endpoints work correctly with authentication.
 */

describe('API Integration Tests', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = next({ dev: false });
    const handle = app.getRequestHandler();
    await app.prepare();

    server = createServer((req, res) => {
      const parsedUrl = parse(req.url || '', true);
      handle(req, res, parsedUrl);
    });

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const address = server.address();
        if (address && typeof address === 'object') {
          baseUrl = `http://localhost:${address.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  describe('Health Check', () => {
    it('should return healthy status without exposing internal services to unauthenticated callers', async () => {
      const response = await fetch(`${baseUrl}/api/health`);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(['ok', 'degraded']).toContain(data.status);
      expect(data.services).toBeUndefined();
    });
  });

  describe('Authentication', () => {
    it('should reject unauthenticated requests to protected routes', async () => {
      const response = await fetch(`${baseUrl}/api/persona`);
      expect(response.status).toBe(401);
    });

    it('should reject invalid login credentials', async () => {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'invalid@test.com', password: 'wrong' }),
      });
      expect(response.status).toBe(401);
    });

    it('should validate login input', async () => {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'not-an-email', password: '' }),
      });
      expect(response.status).toBe(400);
    });
  });

  describe('Rate Limiting', () => {
    it('should rate limit after multiple failed attempts', async () => {
      // Make multiple failed login attempts
      for (let i = 0; i < 6; i++) {
        await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'test@test.com', password: 'wrong' }),
        });
      }

      // Next request should be rate limited
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@test.com', password: 'wrong' }),
      });
      expect(response.status).toBe(429);
    });
  });
});
