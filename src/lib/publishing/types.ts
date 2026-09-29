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

export interface PublishAdapter {
  platform: string;
  supportsApiPublish: boolean;
  connect(token?: string): Promise<void>;
  publish(variant: PostVariantWithDetails): Promise<PublishResult>;
  fetchMetrics(accountId: string): Promise<Metrics>;
}
