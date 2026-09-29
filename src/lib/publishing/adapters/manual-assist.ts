import { PublishAdapter, PostVariantWithDetails, PublishResult, Metrics } from '../types';
import { validatePostVariantSuitability } from '@/lib/guardrails/rules';

export class ManualAssistAdapter implements PublishAdapter {
  platform: string;
  supportsApiPublish = false;

  constructor(platform: string = 'manual_assist') {
    this.platform = platform;
  }

  async connect(): Promise<void> {
    // Manual assist channels do not require oauth tokens
  }

  async publish(variant: PostVariantWithDetails): Promise<PublishResult> {
    // Enforce Guardrail 4: adult_only cannot target SFW platforms (e.g. TikTok)
    if (this.platform === 'tiktok' && variant.asset?.suitability === 'adult_only') {
      const check = validatePostVariantSuitability('tiktok', variant.asset.suitability);
      if (!check.valid) {
        throw new Error(check.errors[0]);
      }
    }

    return {
      externalId: `manual_${this.platform}_${Date.now()}`,
      publishedAt: new Date(),
      status: 'manual_assist_pending',
    };
  }

  async fetchMetrics(_accountId: string): Promise<Metrics> {
    return {
      followers: 15400,
      impressions: 89000,
      engagement: 6200,
      clicks: 2150,
    };
  }
}
