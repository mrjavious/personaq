export type Role = 'owner' | 'admin' | 'editor';

export type Permission =
  | 'manage_users'
  | 'manage_persona'
  | 'upload_assets'
  | 'review_safety_overrides'
  | 'compose_posts'
  | 'schedule_posts'
  | 'approve_replies'
  | 'view_analytics'
  | 'manage_platform_rules';

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: [
    'manage_users',
    'manage_persona',
    'upload_assets',
    'review_safety_overrides',
    'compose_posts',
    'schedule_posts',
    'approve_replies',
    'view_analytics',
    'manage_platform_rules',
  ],
  admin: [
    'manage_persona',
    'upload_assets',
    'review_safety_overrides',
    'compose_posts',
    'schedule_posts',
    'approve_replies',
    'view_analytics',
    'manage_platform_rules',
  ],
  editor: [
    'upload_assets',
    'compose_posts',
    'schedule_posts',
    'approve_replies',
    'view_analytics',
  ],
};

export function hasPermission(role: Role | string, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role as Role];
  if (!perms) return false;
  return perms.includes(permission);
}

export function isValidRole(role: string): role is Role {
  return ['owner', 'admin', 'editor'].includes(role);
}
