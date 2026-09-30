import prisma from '@/lib/db/prisma';

export interface AuditLogInput {
  userId?: string | null;
  action: 'publish' | 'approve' | 'safety_decision' | 'override' | 'settings_change' | 'login' | '2fa_verify' | 'persona_update';
  entity: 'User' | 'Asset' | 'Post' | 'PostVariant' | 'Persona' | 'PlatformRule' | 'DraftReply' | 'LinkHub' | 'System';
  entityId: string;
  meta?: Record<string, unknown> | null;
}

export async function logAuditEvent(input: AuditLogInput) {
  try {
    let validUserId: string | null = null;
    if (input.userId) {
      const userExists = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true },
      });
      if (userExists) {
        validUserId = userExists.id;
      }
    }

    return await prisma.auditLog.create({
      data: {
        userId: validUserId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        meta: JSON.stringify({
          ...(input.meta || {}),
          ...(!validUserId && input.userId ? { actorIdentifier: input.userId } : {}),
        }),
      },
    });
  } catch (error) {
    console.error('Failed to record audit log:', error);
    return null;
  }
}
