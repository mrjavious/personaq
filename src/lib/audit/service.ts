import prisma from '@/lib/db/prisma';

export interface AuditLogFilter {
  action?: string;
  entity?: string;
  userId?: string;
  limit?: number;
  offset?: number;
}

export async function getAuditLogs(filters: AuditLogFilter = {}) {
  const { action, entity, userId, limit = 50, offset = 0 } = filters;

  const where: Record<string, unknown> = {};
  if (action && action !== 'all') where.action = action;
  if (entity && entity !== 'all') where.entity = entity;
  if (userId) where.userId = userId;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { ts: 'desc' },
      take: limit,
      skip: offset,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs,
    total,
    limit,
    offset,
  };
}
