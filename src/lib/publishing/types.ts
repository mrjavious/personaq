export interface Metrics {
  followers: number;
  impressions: number;
  engagement: number;
  clicks: number;
}

export interface PostVariantWithDetails {
  id: string;
  postId: string;
  caption: string;
  hashtags: string[];
  aiLabelApplied: boolean;
  utmLink?: string | null;
  scheduledAt?: Date | null;
  publishedAt?: Date | null;
  externalId?: string | null;
  idempotencyKey?: string;
  asset?: {
    id: string;
    url?: string | null;
    storageKey: string;
    suitability: string;
    safetyStatus: string;
  } | null;
  platformAccount: {
    id: string;
    platform: string;
    handle: string;
    apiStatus: string;
    tokenEncrypted?: string | null;
  };
}

export interface PublishResult {
  externalId: string;
  publishedAt: Date;
  status: 'published' | 'manual_assist_pending' | 'failed';
  error?: string;
}

export class PublishingError extends Error {
  constructor(
    message: string,
    public platform: string,
    public isRetryable: boolean = false,
    public statusCode?: number,
    public retryAfterMs?: number
  ) {
    super(message);
    this.name = 'PublishingError';
  }
}

export function isNonRetryableError(error: unknown): boolean {
  if (error instanceof PublishingError) {
    return !error.isRetryable;
  }
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();
  if (
    lower.includes('guardrail') ||
    lower.includes('safety') ||
    lower.includes('exceeds') ||
    lower.includes('not found') ||
    lower.includes('already published') ||
    lower.includes('already in progress') ||
    (lower.includes('limit') && (lower.includes('character') || lower.includes('length'))) ||
    lower.includes('prohibited')
  ) {
    return true;
  }
  return false;
}

export interface PublishAdapter {
  platform: string;
  supportsApiPublish: boolean;
  connect(token?: string): Promise<void>;
  publish(variant: PostVariantWithDetails): Promise<PublishResult>;
  fetchMetrics(accountId: string): Promise<Metrics>;
}
