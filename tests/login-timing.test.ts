import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/db/prisma';
import { POST } from '@/app/api/auth/login/route';

import type { User } from '@prisma/client';

vi.mock('@/lib/db/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/security/rate-limit', () => ({
  checkLoginRateLimit: vi.fn(() => ({ allowed: true })),
  recordLoginAttempt: vi.fn(),
}));

describe('Login timing attack mitigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls bcrypt.compare even when user does not exist', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const compareSpy = vi.spyOn(bcrypt, 'compare');

    const req = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nonexistent@example.com',
        password: 'Password123!',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(compareSpy).toHaveBeenCalledTimes(1);
    const compareArgs = compareSpy.mock.calls[0];
    expect(compareArgs[0]).toBe('Password123!');
    // second arg should be the dummy hash string
    expect(typeof compareArgs[1]).toBe('string');
  });

  it('calls bcrypt.compare when user does exist', async () => {
    const mockHash = '$2a$10$abcdefghijklmnopqrstuvwxyz123456';
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-real',
      email: 'real@example.com',
      passwordHash: mockHash,
      role: 'owner',
      twoFactorSecret: null,
      twoFactorBackupCodes: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as User);

    const compareSpy = vi.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

    const req = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'real@example.com',
        password: 'WrongPassword!',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(compareSpy).toHaveBeenCalledTimes(1);
    expect(compareSpy).toHaveBeenCalledWith('WrongPassword!', mockHash);
  });
});
