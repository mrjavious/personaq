import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hasPermission, isValidRole, Permission } from '@/lib/auth/rbac';
import { withApi } from '@/lib/api/handler';
import * as session from '@/lib/auth/session';
import { NextResponse } from 'next/server';

describe('RBAC permissions matrix', () => {
  const allPermissions: Permission[] = [
    'manage_users',
    'manage_persona',
    'upload_assets',
    'review_safety_overrides',
    'compose_posts',
    'schedule_posts',
    'approve_replies',
    'view_analytics',
    'manage_platform_rules',
  ];

  it('validates role names correctly', () => {
    expect(isValidRole('owner')).toBe(true);
    expect(isValidRole('admin')).toBe(true);
    expect(isValidRole('editor')).toBe(true);
    expect(isValidRole('superadmin')).toBe(false);
    expect(isValidRole('viewer')).toBe(false);
    expect(isValidRole('')).toBe(false);
  });

  describe('owner role', () => {
    it('has all permissions', () => {
      for (const perm of allPermissions) {
        expect(hasPermission('owner', perm)).toBe(true);
      }
    });
  });

  describe('admin role', () => {
    it('has all permissions except manage_users', () => {
      expect(hasPermission('admin', 'manage_users')).toBe(false);

      const allowedForAdmin: Permission[] = [
        'manage_persona',
        'upload_assets',
        'review_safety_overrides',
        'compose_posts',
        'schedule_posts',
        'approve_replies',
        'view_analytics',
        'manage_platform_rules',
      ];
      for (const perm of allowedForAdmin) {
        expect(hasPermission('admin', perm)).toBe(true);
      }
    });
  });

  describe('editor role', () => {
    it('cannot manage_users, manage_persona, review_safety_overrides, or manage_platform_rules', () => {
      const forbiddenForEditor: Permission[] = [
        'manage_users',
        'manage_persona',
        'review_safety_overrides',
        'manage_platform_rules',
      ];
      for (const perm of forbiddenForEditor) {
        expect(hasPermission('editor', perm)).toBe(false);
      }
    });

    it('can upload_assets, compose_posts, schedule_posts, approve_replies, view_analytics', () => {
      const allowedForEditor: Permission[] = [
        'upload_assets',
        'compose_posts',
        'schedule_posts',
        'approve_replies',
        'view_analytics',
      ];
      for (const perm of allowedForEditor) {
        expect(hasPermission('editor', perm)).toBe(true);
      }
    });
  });

  describe('invalid/unknown roles', () => {
    it('denies all permissions for invalid or empty role', () => {
      for (const perm of allPermissions) {
        expect(hasPermission('guest', perm)).toBe(false);
        expect(hasPermission('', perm)).toBe(false);
      }
    });
  });

  describe('withApi enforcement on editor role', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
      vi.spyOn(session, 'getCurrentUser').mockResolvedValue({
        userId: 'editor-1',
        email: 'editor@example.com',
        role: 'editor',
        twoFactorAuthenticated: true,
      });
    });

    it('returns 403 when editor attempts to access manage_persona endpoint', async () => {
      const handler = withApi(
        async () => NextResponse.json({ ok: true }),
        { permission: 'manage_persona' }
      );
      const req = new Request('http://localhost:3000/api/persona');
      const res = await handler(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('Forbidden');
    });

    it('returns 403 when editor attempts to review safety overrides', async () => {
      const handler = withApi(
        async () => NextResponse.json({ ok: true }),
        { permission: 'review_safety_overrides' }
      );
      const req = new Request('http://localhost:3000/api/assets/1/override');
      const res = await handler(req);
      expect(res.status).toBe(403);
    });

    it('returns 403 when editor attempts to manage platform rules', async () => {
      const handler = withApi(
        async () => NextResponse.json({ ok: true }),
        { permission: 'manage_platform_rules' }
      );
      const req = new Request('http://localhost:3000/api/platform-rules');
      const res = await handler(req);
      expect(res.status).toBe(403);
    });

    it('returns 200 when editor accesses allowed compose_posts endpoint', async () => {
      const handler = withApi(
        async () => NextResponse.json({ success: true, composed: true }),
        { permission: 'compose_posts' }
      );
      const req = new Request('http://localhost:3000/api/posts');
      const res = await handler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.composed).toBe(true);
    });
  });
});
