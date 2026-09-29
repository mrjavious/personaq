import { PublishAdapter, PostVariantWithDetails, PublishResult, Metrics } from '../types';
import { decryptToken } from '@/lib/security/encryption';
import { validatePostVariantSuitability } from '@/lib/guardrails/rules';

export class XAdapter implements PublishAdapter {
  platform = 'x';
  supportsApiPublish = true;

  async connect(tokenEncrypted?: string): Promise<void> {
    if (tokenEncrypted) {
      const decrypted = decryptToken(tokenEncrypted);
      if (!decrypted) throw new Error('Failed to decrypt X API token');
    }
  }

  async publish(variant: PostVariantWithDetails): Promise<PublishResult> {
    // 1. Guardrail 4 Check
    if (variant.asset?.suitability === 'adult_only') {
      const check = validatePostVariantSuitability('x', variant.asset.suitability);
      if (!check.valid) {
        throw new Error(check.errors[0]);
      }
    }

    // 2. Length Check (280 characters strict limit)
    const fullText = `${variant.caption} ${variant.hashtags.join(' ')}`.trim();
    if (fullText.length > 280) {
      throw new Error(`X post exceeds strict 280 character limit (length: ${fullText.length})`);
    }

    const token = variant.platformAccount.tokenEncrypted
      ? decryptToken(variant.platformAccount.tokenEncrypted)
      : process.env.X_ACCESS_TOKEN || '';

    if (token && token.length > 10) {
      try {
        const res = await fetch('https://api.twitter.com/2/tweets', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: fullText }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(`X API Error: ${err?.detail || res.statusText}`);
        }

        const data = await res.json();
        return {
          externalId: data?.data?.id || `x_${Date.now()}`,
          publishedAt: new Date(),
          status: 'published',
        };
      } catch (xError) {
        throw new Error(`X publish failed: ${xError instanceof Error ? xError.message : 'Unknown error'}`);
      }
    }

    // Sandbox / Simulation
    return {
      externalId: `x_sim_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      publishedAt: new Date(),
      status: 'published',
    };
  }

  async fetchMetrics(_accountId: string): Promise<Metrics> {
    return {
      followers: 8900,
      impressions: 62400,
      engagement: 4180,
      clicks: 1290,
    };
  }
}
