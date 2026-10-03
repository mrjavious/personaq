import { PublishAdapter, PostVariantWithDetails, PublishResult, Metrics, PublishingError } from '../types';
import { decryptToken } from '@/lib/security/encryption';
import { validatePostVariantSuitability } from '@/lib/guardrails/rules';

export class XAdapter implements PublishAdapter {
  platform = 'x';
  supportsApiPublish = true;

  async connect(tokenEncrypted?: string): Promise<void> {
    if (tokenEncrypted) {
      const decrypted = decryptToken(tokenEncrypted);
      if (!decrypted) throw new PublishingError('Failed to decrypt X API token', 'x', false, 401);
    }
  }

  async publish(variant: PostVariantWithDetails): Promise<PublishResult> {
    // 1. Guardrail 4 Check
    if (variant.asset?.suitability === 'adult_only') {
      const check = validatePostVariantSuitability('x', variant.asset.suitability);
      if (!check.valid) {
        throw new PublishingError(check.errors[0], 'x', false, 400);
      }
    }

    // 2. Length Check (280 characters strict limit)
    const fullText = `${variant.caption} ${variant.hashtags.join(' ')}`.trim();
    if (fullText.length > 280) {
      throw new PublishingError(
        `X post exceeds strict 280 character limit (length: ${fullText.length})`,
        'x',
        false,
        400
      );
    }

    const token = variant.platformAccount.tokenEncrypted
      ? decryptToken(variant.platformAccount.tokenEncrypted)
      : process.env.X_ACCESS_TOKEN || '';

    const idempotencyKey = variant.idempotencyKey || `x_${Date.now()}`;

    if (token && token.length > 10) {
      try {
        const res = await fetch('https://api.twitter.com/2/tweets', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify({ text: fullText }),
        });

        if (res.status === 429) {
          const retryAfter = res.headers.get('retry-after');
          const retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5000;
          throw new PublishingError('X API rate limit exceeded', 'x', true, 429, retryAfterMs);
        }

        if (!res.ok) {
          const isServerErr = res.status >= 500;
          const err = await res.json().catch(() => ({}));
          throw new PublishingError(
            `X API Error: ${err?.detail || res.statusText}`,
            'x',
            isServerErr,
            res.status
          );
        }

        const data = await res.json();
        return {
          externalId: data?.data?.id || `x_${idempotencyKey.slice(0, 16)}`,
          publishedAt: new Date(),
          status: 'published',
        };
      } catch (xError) {
        if (xError instanceof PublishingError) throw xError;
        throw new PublishingError(
          `X publish failed: ${xError instanceof Error ? xError.message : 'Unknown error'}`,
          'x',
          true
        );
      }
    }

    // Sandbox / Simulation with deterministic idempotency key
    return {
      externalId: `x_sim_${idempotencyKey.slice(0, 16)}`,
      publishedAt: new Date(),
      status: 'published',
    };
  }

  async fetchMetrics(_accountId: string): Promise<Metrics> {
    void _accountId;
    return {
      followers: 8900,
      impressions: 62400,
      engagement: 4180,
      clicks: 1290,
    };
  }
}
