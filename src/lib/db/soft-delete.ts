/**
 * Soft delete utilities for Prisma models.
 * Models with deletedAt field: Persona, Post, Asset, LinkHub
 */

/**
 * Helper to soft delete a record.
 */
export async function softDelete(
  model: 'Persona' | 'Post' | 'Asset' | 'LinkHub',
  id: string,
): Promise<void> {
  const { prisma } = await import('@/lib/db');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any)[model.toLowerCase()].update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

/**
 * Helper to restore a soft-deleted record.
 */
export async function restoreSoftDeleted(
  model: 'Persona' | 'Post' | 'Asset' | 'LinkHub',
  id: string,
): Promise<void> {
  const { prisma } = await import('@/lib/db');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any)[model.toLowerCase()].update({
    where: { id },
    data: { deletedAt: null },
  });
}

/**
 * Helper to find non-deleted records.
 */
export async function findActive<T extends { deletedAt?: Date | null }>(
  model: 'Persona' | 'Post' | 'Asset' | 'LinkHub',
  args: Record<string, unknown> = {},
): Promise<T[]> {
  const { prisma } = await import('@/lib/db');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (prisma as any)[model.toLowerCase()].findMany({
    ...args,
    where: {
      ...((args.where as Record<string, unknown>) || {}),
      deletedAt: null,
    },
  });
}
