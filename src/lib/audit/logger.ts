import prisma from '@/lib/db/prisma';

export interface AuditLogInput {
  userId?: string | null;
  action: 'publish' | 'approve' | 'safety_decision' | 'override' | 'settings_change' | 'login' | '2fa_verify' | 'persona_update';
  entity: 'User' | 'Asset' | 'Post' | 'PostVariant' | 'Persona' | 'PlatformRule' | 'System';
  entityId: string;
  meta?: Record<string, unknown> | null;
}

export async function logAuditEvent(input: AuditLogInput) {
  try {
    return await prisma.auditLog.create({
      data: {
        userId: input.userId || null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        meta: input.meta ? JSON.stringify(input.meta) : null,
      },
    });
  } catch (error) {
    console.error('Failed to record audit log:', error);
    return null;
  }
}
