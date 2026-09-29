import prisma from '@/lib/db/prisma';
import { validatePostVariantSuitability, validateAssetForScheduling } from '@/lib/guardrails/rules';
import { logAuditEvent } from '@/lib/audit/logger';

export interface VariantInput {
  id?: string;
  platformAccountId: string;
  platform: string;
  assetId?: string | null;
  caption: string;
  hashtags: string[];
  aiLabelApplied: boolean;
  scheduledAt?: string | null;
  utmLink?: string | null;
}

export interface PostInput {
  personaId: string;
  concept: string;
  status: 'draft' | 'pending_safety' | 'approved' | 'scheduled' | 'published' | 'failed';
  variants: VariantInput[];
}

export async function createPostWithVariants(input: PostInput, userId?: string) {
  // 1. Enforce Guardrails across all variants
  for (const variant of input.variants) {
    if (variant.assetId) {
      const asset = await prisma.asset.findUnique({ where: { id: variant.assetId } });
      if (!asset) throw new Error(`Asset not found: ${variant.assetId}`);

      // Guardrail 4: Suitability separation
      const suitabilityCheck = validatePostVariantSuitability(variant.platform, asset.suitability);
      if (!suitabilityCheck.valid) {
        throw new Error(suitabilityCheck.errors.join('; '));
      }

      // Guardrail 5.3: If post is scheduled, asset MUST have passed safety gate
      if (input.status === 'scheduled') {
        const schedulingCheck = validateAssetForScheduling({
          safetyStatus: asset.safetyStatus,
          suitability: asset.suitability,
          targetPlatform: variant.platform,
        });
        if (!schedulingCheck.valid) {
          throw new Error(schedulingCheck.errors.join('; '));
        }
      }
    }
  }

  // 2. Create Post and Variants in transaction
  const post = await prisma.post.create({
    data: {
      personaId: input.personaId,
      concept: input.concept,
      status: input.status,
      variants: {
        create: input.variants.map((v) => ({
          platformAccountId: v.platformAccountId,
          assetId: v.assetId || null,
          caption: v.caption,
          hashtags: JSON.stringify(v.hashtags || []),
          aiLabelApplied: v.aiLabelApplied ?? true,
          scheduledAt: v.scheduledAt ? new Date(v.scheduledAt) : null,
          utmLink: v.utmLink || null,
        })),
      },
    },
    include: {
      variants: {
        include: {
          asset: true,
          platformAccount: true,
        },
      },
    },
  });

  await logAuditEvent({
    userId,
    action: input.status === 'scheduled' ? 'publish' : 'settings_change',
    entity: 'Post',
    entityId: post.id,
    meta: {
      action: 'created',
      status: post.status,
      variantCount: post.variants.length,
      platforms: post.variants.map((v) => v.platformAccount.platform),
    },
  });

  return post;
}

export async function updatePostWithVariants(id: string, input: PostInput, userId?: string) {
  // Validate variants
  for (const variant of input.variants) {
    if (variant.assetId) {
      const asset = await prisma.asset.findUnique({ where: { id: variant.assetId } });
      if (!asset) throw new Error(`Asset not found: ${variant.assetId}`);

      const suitabilityCheck = validatePostVariantSuitability(variant.platform, asset.suitability);
      if (!suitabilityCheck.valid) {
        throw new Error(suitabilityCheck.errors.join('; '));
      }

      if (input.status === 'scheduled') {
        const schedulingCheck = validateAssetForScheduling({
          safetyStatus: asset.safetyStatus,
          suitability: asset.suitability,
          targetPlatform: variant.platform,
        });
        if (!schedulingCheck.valid) {
          throw new Error(schedulingCheck.errors.join('; '));
        }
      }
    }
  }

  // Delete old variants and re-create for clean state
  await prisma.postVariant.deleteMany({ where: { postId: id } });

  const updatedPost = await prisma.post.update({
    where: { id },
    data: {
      concept: input.concept,
      status: input.status,
      variants: {
        create: input.variants.map((v) => ({
          platformAccountId: v.platformAccountId,
          assetId: v.assetId || null,
          caption: v.caption,
          hashtags: JSON.stringify(v.hashtags || []),
          aiLabelApplied: v.aiLabelApplied ?? true,
          scheduledAt: v.scheduledAt ? new Date(v.scheduledAt) : null,
          utmLink: v.utmLink || null,
        })),
      },
    },
    include: {
      variants: {
        include: {
          asset: true,
          platformAccount: true,
        },
      },
    },
  });

  await logAuditEvent({
    userId,
    action: 'settings_change',
    entity: 'Post',
    entityId: id,
    meta: { action: 'updated', status: updatedPost.status },
  });

  return updatedPost;
}

export async function getAllPosts(personaId?: string) {
  const where: Record<string, unknown> = {};
  if (personaId) where.personaId = personaId;

  return prisma.post.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      variants: {
        include: {
          asset: true,
          platformAccount: true,
        },
      },
    },
  });
}

export async function getCalendarPosts(startDate?: string, endDate?: string) {
  const variants = await prisma.postVariant.findMany({
    where: {
      scheduledAt: {
        not: null,
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      },
    },
    orderBy: { scheduledAt: 'asc' },
    include: {
      post: true,
      asset: true,
      platformAccount: true,
    },
  });

  return variants;
}

export async function deletePost(id: string, userId?: string) {
  await prisma.post.delete({ where: { id } });

  await logAuditEvent({
    userId,
    action: 'settings_change',
    entity: 'Post',
    entityId: id,
    meta: { action: 'deleted' },
  });

  return { success: true };
}
