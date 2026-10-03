import { NextResponse } from 'next/server';
import { getCurrentUser, type SessionPayload } from './session';
import { hasPermission, type Permission } from './rbac';

export { ApiError } from '@/lib/api/error';
import { ApiError } from '@/lib/api/error';

export function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message, success: false }, { status });
}

export async function requireAuth(): Promise<SessionPayload> {
  const user = await getCurrentUser();
  if (!user) {
    throw new ApiError(401, 'Unauthorized');
  }
  return user;
}

export async function requirePermission(
  permission: Permission,
): Promise<SessionPayload> {
  const user = await requireAuth();
  if (!hasPermission(user.role, permission)) {
    throw new ApiError(403, 'Forbidden');
  }
  return user;
}
