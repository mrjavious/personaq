import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiError, errorResponse, requireAuth, requirePermission } from '@/lib/auth/guards';
import { hasPermission, type Permission } from '@/lib/auth/rbac';

// Mock the session module
vi.mock('@/lib/auth/session', () => ({
  getCurrentUser: vi.fn(),
}));

import { getCurrentUser } from '@/lib/auth/session';

describe('auth-guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ApiError', () => {
    it('creates error with status code and message', () => {
      const error = new ApiError(401, 'Unauthorized');
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Unauthorized');
      expect(error.name).toBe('ApiError');
    });
  });

  describe('errorResponse', () => {
    it('returns NextResponse with error message and status', async () => {
      const response = errorResponse('Not found', 404);
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toBe('Not found');
      expect(body.success).toBe(false);
    });
  });

  describe('requireAuth', () => {
    it('throws 401 when user is not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);
      await expect(requireAuth()).rejects.toThrow('Unauthorized');
    });

    it('returns user when authenticated', async () => {
      const mockUser = {
        userId: 'user-1',
        email: 'test@example.com',
        role: 'owner' as const,
        twoFactorAuthenticated: true,
      };
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      const result = await requireAuth();
      expect(result).toEqual(mockUser);
    });
  });

  describe('requirePermission', () => {
    it('throws 403 when user lacks permission', async () => {
      const mockUser = {
        userId: 'user-1',
        email: 'test@example.com',
        role: 'editor' as const,
        twoFactorAuthenticated: true,
      };
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      await expect(requirePermission('manage_users')).rejects.toThrow('Forbidden');
    });

    it('returns user when they have permission', async () => {
      const mockUser = {
        userId: 'user-1',
        email: 'test@example.com',
        role: 'owner' as const,
        twoFactorAuthenticated: true,
      };
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      const result = await requirePermission('manage_users');
      expect(result).toEqual(mockUser);
    });
  });

  describe('hasPermission', () => {
    it('returns true for owner with any permission', () => {
      expect(hasPermission('owner', 'manage_users')).toBe(true);
      expect(hasPermission('owner', 'manage_persona')).toBe(true);
    });

    it('returns false for editor with admin permission', () => {
      expect(hasPermission('editor', 'manage_users')).toBe(false);
      expect(hasPermission('editor', 'manage_persona')).toBe(false);
    });

    it('returns true for editor with allowed permission', () => {
      expect(hasPermission('editor', 'compose_posts')).toBe(true);
      expect(hasPermission('editor', 'upload_assets')).toBe(true);
    });
  });
});
