import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

export const verify2FASchema = z.object({
  token: z.string().min(1).max(32),
  isBackupCode: z.boolean().optional(),
});

export const setup2FASchema = z.object({
  token: z.string().min(1).max(32),
  secret: z.string().min(1).max(256),
  backupCodes: z.array(z.string()).optional(),
});

export const createPostSchema = z.object({
  personaId: z.string().min(1),
  concept: z.string().min(1).max(1000),
  status: z.enum(['draft', 'pending_safety', 'approved', 'scheduled', 'published', 'failed']),
  variants: z.array(z.object({
    platformAccountId: z.string().min(1),
    platform: z.string().min(1).max(50),
    assetId: z.string().nullable().optional(),
    caption: z.string().min(1).max(5000),
    hashtags: z.array(z.string()).default([]),
    aiLabelApplied: z.boolean().default(true),
    scheduledAt: z.string().datetime().nullable().optional(),
    utmLink: z.string().url().nullable().optional(),
  })).min(1),
});

export const createPersonaSchema = z.object({
  name: z.string().min(1).max(100),
  adultAge: z.number().int().min(21).max(120),
  backstory: z.string().min(1).max(5000),
  appearanceNotes: z.string().min(1).max(5000),
  voiceTone: z.string().min(1).max(500),
  catchphrases: z.array(z.string()).default([]),
  boundaries: z.array(z.string()).default([]),
  contentPillars: z.array(z.string()).default([]),
  aiDisclosureText: z.string().min(1).max(1000),
});

export const createLinkSchema = z.object({
  slug: z.string().min(1).max(100),
  destinationUrl: z.string().url().max(2048),
  personaId: z.string().optional(),
  isNeutralLanding: z.boolean().default(true),
});

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
