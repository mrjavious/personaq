import { z } from 'zod';

export const loginSchema = z
  .object({
    email: z.string().email().max(255),
    password: z.string().min(1).max(128),
  })
  .strict();

export const verify2FASchema = z
  .object({
    token: z.string().min(1).max(32),
    isBackupCode: z.boolean().optional(),
  })
  .strict();

export const setup2FASchema = z
  .object({
    token: z.string().min(1).max(32),
    secret: z.string().min(1).max(256),
    backupCodes: z.array(z.string()).optional(),
  })
  .strict();

export const createPostSchema = z
  .object({
    personaId: z.string().min(1),
    concept: z.string().min(1).max(1000),
    status: z.enum(['draft', 'pending_safety', 'approved', 'scheduled', 'published', 'failed']),
    variants: z
      .array(
        z.object({
          platformAccountId: z.string().min(1),
          platform: z.string().min(1).max(50),
          assetId: z.string().nullable().optional(),
          caption: z.string().min(1).max(5000),
          hashtags: z.array(z.string()).default([]),
          aiLabelApplied: z.boolean().default(true),
          scheduledAt: z.string().datetime().nullable().optional(),
          utmLink: z.string().url().nullable().optional(),
        }),
      )
      .min(1),
  })
  .strict();

export const updatePostSchema = z
  .object({
    concept: z.string().min(1).max(1000).optional(),
    status: z.enum(['draft', 'pending_safety', 'approved', 'scheduled', 'published', 'failed']).optional(),
    variants: z
      .array(
        z.object({
          id: z.string().optional(),
          platformAccountId: z.string().min(1),
          platform: z.string().min(1).max(50),
          assetId: z.string().nullable().optional(),
          caption: z.string().min(1).max(5000),
          hashtags: z.array(z.string()).default([]),
          aiLabelApplied: z.boolean().default(true),
          scheduledAt: z.string().datetime().nullable().optional(),
          utmLink: z.string().url().nullable().optional(),
        }),
      )
      .optional(),
  })
  .strict();

export const createPersonaSchema = z
  .object({
    name: z.string().min(1).max(100),
    adultAge: z.number().int().min(21).max(120),
    backstory: z.string().min(1).max(5000),
    appearanceNotes: z.string().min(1).max(5000),
    voiceTone: z.string().min(1).max(500),
    catchphrases: z.array(z.string()).default([]),
    boundaries: z.array(z.string()).default([]),
    contentPillars: z.array(z.string()).default([]),
    aiDisclosureText: z.string().min(1).max(1000),
  })
  .strict();

export const updatePersonaSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    adultAge: z.number().int().min(21).max(120).optional(),
    backstory: z.string().min(1).max(5000).optional(),
    appearanceNotes: z.string().min(1).max(5000).optional(),
    voiceTone: z.string().min(1).max(500).optional(),
    catchphrases: z.array(z.string()).optional(),
    boundaries: z.array(z.string()).optional(),
    contentPillars: z.array(z.string()).optional(),
    aiDisclosureText: z.string().min(1).max(1000).optional(),
    avatarUrl: z.string().nullable().optional(),
    visualModelConfig: z.string().nullable().optional(),
  })
  .strict();

export const generateContentSchema = z
  .object({
    personaId: z.string().min(1),
    prompt: z.string().min(1).max(2000),
    mediaType: z.enum(['image', 'video']).default('image'),
    stylePreset: z.string().max(100).optional(),
    aspectRatio: z.string().max(20).optional(),
    cameraAngle: z.string().max(50).optional(),
    sceneContext: z.string().max(500).optional(),
    isFaceLocked: z.boolean().optional(),
  })
  .strict();

export const generateVisualSchema = z
  .object({
    personaId: z.string().min(1),
    angle: z.string().min(1).max(50).optional(),
    options: z.record(z.string(), z.unknown()).optional(),
    isFaceLocked: z.boolean().optional(),
  })
  .strict();

export const lockFaceSchema = z
  .object({
    personaId: z.string().min(1),
    assetId: z.string().min(1).optional(),
    confirm: z.boolean().optional(),
  })
  .strict();

export const markVisualModelSchema = z
  .object({
    personaId: z.string().min(1),
    assetId: z.string().min(1),
    angle: z.string().optional(),
  })
  .strict();

export const uploadReferenceSchema = z
  .object({
    personaId: z.string().min(1),
    role: z.string().optional(),
  });

export const promptPreviewSchema = z
  .object({
    personaId: z.string().optional(),
    options: z.record(z.string(), z.unknown()).optional(),
  });

export const aiBuilderSchema = z
  .object({
    messages: z.array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string().min(1).max(5000),
      }),
    ).min(1),
  })
  .strict();

export const assetUploadMetadataSchema = z.object({
  personaId: z.string().min(1),
  suitability: z.enum(['sfw_general', 'sfw_sensual', 'sfw_erotic', 'adult_content']).optional(),
  mediaType: z.enum(['image', 'video']).optional(),
  tags: z.array(z.string()).optional(),
  aiGenerated: z.boolean().optional(),
  isReference: z.boolean().optional(),
});

export const assetOverrideSchema = z
  .object({
    justification: z.string().min(10).max(1000),
    suitability: z.enum(['sfw_general', 'sfw_sensual', 'sfw_erotic', 'adult_content']),
  })
  .strict();

export const createPlatformAccountSchema = z
  .object({
    personaId: z.string().min(1),
    platform: z.enum(['instagram', 'tiktok', 'twitter', 'threads', 'youtube', 'onlyfans']),
    handle: z.string().min(1).max(100),
    disclosureInBio: z.boolean().default(true),
  })
  .strict();

export const updatePlatformAccountSchema = z
  .object({
    handle: z.string().min(1).max(100).optional(),
    apiStatus: z.enum(['active', 'paused', 'revoked', 'warning']).optional(),
    disclosureInBio: z.boolean().optional(),
  })
  .strict();

export const dispatchPublishingSchema = z
  .object({
    variantId: z.string().optional(),
    postVariantId: z.string().optional(),
    mode: z.enum(['single', 'scheduled_batch']).optional(),
  });

export const workerPublishingSchema = z
  .object({
    batchSize: z.number().int().min(1).max(100).optional(),
  });

export const generateEngagementSchema = z
  .object({
    platformAccountId: z.string().min(1),
    commentText: z.string().min(1).max(2000),
    contextUrl: z.string().url().max(1000).optional(),
  })
  .strict();

export const createDraftReplySchema = z
  .object({
    platformAccountId: z.string().min(1),
    contextText: z.string().min(1).max(2000),
    suggestedText: z.string().min(1).max(2000),
    status: z.enum(['draft', 'approved', 'rejected']).optional(),
  })
  .strict();

export const updateDraftReplySchema = z
  .object({
    action: z.enum(['approve', 'reject', 'update']),
    editedText: z.string().min(1).max(2000).optional(),
  })
  .strict();

export const platformRuleSchema = z
  .object({
    platform: z.string().min(1).max(50),
    maxChars: z.number().int().positive().optional(),
    maxHashtags: z.number().int().nonnegative().optional(),
    aiDisclosureRequired: z.boolean().optional(),
    bannedKeywords: z.array(z.string()).optional(),
    contentGuidelines: z.string().max(5000).optional(),
  })
  .strict();

export const updatePlatformRuleSchema = z
  .object({
    platform: z.string().min(1).max(50),
    rulesJson: z.string().min(2),
  })
  .strict();

export const verifyPlatformRuleSchema = z
  .object({
    caption: z.string().min(1),
    hashtags: z.array(z.string()).optional(),
    aiLabelApplied: z.boolean().optional(),
  })
  .strict();

export const analyticsImportSchema = z
  .object({
    csvData: z.string().min(1),
  })
  .strict();

export const comfyuiGenerateSchema = z
  .object({
    prompt: z.string().min(1).max(2000),
    negativePrompt: z.string().max(2000).optional(),
    aspectRatio: z.enum(['1:1', '4:5', '9:16', '16:9']).optional(),
    workflowId: z.string().optional(),
    parameters: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const aiCaptionSchema = z
  .object({
    concept: z.string().min(1).max(2000).optional(),
    topic: z.string().min(1).max(500).optional(),
    personaId: z.string().optional(),
    platform: z.string().max(50).optional(),
    assetDescription: z.string().max(2000).optional(),
    style: z.string().max(100).optional(),
  })
  .refine((data) => Boolean(data.concept || data.topic), {
    message: 'Either concept or topic is required',
  });

export const createLinkSchema = z
  .object({
    slug: z.string().min(1).max(100),
    destinationUrl: z.string().url().max(2048),
    personaId: z.string().optional(),
    isNeutralLanding: z.boolean().default(true),
  })
  .strict();

export const updateLinkSchema = z
  .object({
    slug: z.string().min(1).max(100).optional(),
    destinationUrl: z.string().url().max(2048).optional(),
    personaId: z.string().optional(),
    isNeutralLanding: z.boolean().optional(),
  })
  .strict();

export const linkClickSchema = z
  .object({
    linkId: z.string().optional(),
    slug: z.string().optional(),
    utmSource: z.string().max(100).optional(),
    utmMedium: z.string().max(100).optional(),
    utmCampaign: z.string().max(100).optional(),
    utmContent: z.string().max(200).optional(),
    referrer: z.string().max(500).optional(),
  });

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
