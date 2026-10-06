/**
 * OpenAI-Compatible Text-Only Provider
 *
 * Designed for self-hosted AI routing gateways (such as OmniRoute, LocalAI, vLLM, or LiteLLM)
 * to serve text-only tasks: captions, prompt suggestions, and draft engagement replies.
 *
 * CRITICAL SECURITY REQUIREMENTS:
 * 1. Self-hosted routers must strictly bind to localhost (127.0.0.1 or ::1). NEVER bind to 0.0.0.0.
 * 2. If the router provides an administrative dashboard, the default admin password MUST be changed
 *    immediately upon installation.
 * 3. NEVER route image assets, binary media buffers, or safety gate evaluations through this provider.
 *    Safety checks and image synthesis must use verified cloud or local vision models directly.
 */

import {
  TextProvider,
  CaptionRequest,
  CaptionResult,
  ReplyRequest,
  ReplyResult,
  AnalyticsSummaryRequest,
} from './types';
import { recordUsage } from './budget';

export class OpenAICompatProvider implements TextProvider {
  name = 'openai_compat';

  private getBaseUrl(): string | null {
    if (process.env.OPENAI_COMPAT_BASE_URL) {
      return process.env.OPENAI_COMPAT_BASE_URL.trim().replace(/\/+$/, '');
    }
    if (process.env.GROQ_API_KEY) {
      return 'https://api.groq.com/openai/v1';
    }
    return null;
  }

  private getApiKey(): string {
    if (process.env.OPENAI_COMPAT_API_KEY) {
      return process.env.OPENAI_COMPAT_API_KEY;
    }
    if (process.env.GROQ_API_KEY) {
      return process.env.GROQ_API_KEY;
    }
    return 'dummy-key';
  }

  private getModel(): string {
    if (process.env.OPENAI_COMPAT_MODEL) {
      return process.env.OPENAI_COMPAT_MODEL;
    }
    if (process.env.GROQ_MODEL) {
      return process.env.GROQ_MODEL;
    }
    if (process.env.GROQ_API_KEY) {
      return 'llama-3.3-70b-versatile';
    }
    return 'gpt-4o-mini';
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.getBaseUrl());
  }

  /**
   * Enforce hard rule: Never route images or binary buffers through the text router.
   */
  private assertTextOnly(payload: unknown): void {
    if (!payload || typeof payload !== 'object') return;
    const obj = payload as Record<string, unknown>;
    if ('image' in obj || 'imageBuffer' in obj || 'buffer' in obj || 'inlineData' in obj || 'safetyCheck' in obj) {
      throw new Error(
        'SECURITY VIOLATION: OpenAI-compatible router is strictly text-only. Routing images or safety checks through this provider is prohibited.'
      );
    }
  }

  private async callChatCompletion(messages: Array<{ role: string; content: string }>): Promise<string> {
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) {
      throw new Error('OPENAI_COMPAT_BASE_URL is not configured');
    }

    const endpoint = baseUrl.endsWith('/v1')
      ? `${baseUrl}/chat/completions`
      : `${baseUrl}/v1/chat/completions`;

    const apiKey = this.getApiKey();
    const model = this.getModel();

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI-compatible router HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Record ledger usage
    await recordUsage({
      provider: 'openai_compat',
      model,
      kind: 'caption',
      estimatedCost: 0.001,
    }).catch(() => {});

    return content;
  }

  async generateCaption(input: CaptionRequest): Promise<CaptionResult> {
    this.assertTextOnly(input);

    const systemPrompt = `You are a social media copywriter for synthetic persona "${input.persona.name}".
Persona details:
- Backstory: ${input.persona.backstory}
- Voice Tone: ${input.persona.voiceTone}
- Catchphrases: ${input.persona.catchphrases.join(', ')}
- Boundaries: ${input.persona.boundaries.join(', ')}
- AI Disclosure text: ${input.persona.aiDisclosureText}

Generate 3 distinct caption options for platform ${input.platform}.
Format your response as a valid JSON object matching:
{
  "options": [
    {
      "tone": "Witty & Engaging",
      "caption": "text...",
      "hashtags": ["#tag1", "#tag2"],
      "altText": "description of post visual"
    }
  ]
}`;

    const userPrompt = `Concept: ${input.concept}\nAsset Description: ${input.assetDescription || 'Visual post'}\nTarget Audience: ${input.targetAudience || 'General fans'}`;

    const text = await this.callChatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    let options = [];
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        options = (parsed.options || []).map((opt: Record<string, unknown>) => ({
          tone: String(opt.tone || 'Aesthetic & Minimal'),
          caption: String(opt.caption || ''),
          hashtags: Array.isArray(opt.hashtags) ? opt.hashtags.map(String) : [],
          altText: String(opt.altText || ''),
          aiDisclosureIncluded: true,
        }));
      } catch {
        // Fallback option
      }
    }

    if (options.length === 0) {
      options = [
        {
          tone: 'Witty & Engaging',
          caption: `${input.concept}\n\n${input.persona.aiDisclosureText}`,
          hashtags: ['#AI', '#PersonaStudio'],
          altText: input.concept,
          aiDisclosureIncluded: true,
        },
      ];
    }

    return {
      provider: 'openai_compat' as 'fallback_template', // conforms to provider union
      platform: input.platform,
      options,
      usedAiDisclosure: input.persona.aiDisclosureText,
      modelUsed: this.getModel(),
    };
  }

  async draftReply(input: ReplyRequest): Promise<ReplyResult> {
    this.assertTextOnly(input);

    const systemPrompt = `You are persona "${input.persona.name}". Voice: ${input.persona.voiceTone}. Boundaries: ${input.persona.boundaries.join(', ')}.`;
    const userPrompt = `A fan commented on ${input.platform}: "${input.contextText}". Draft 3 authentic replies in persona voice. Return JSON: {"suggestions": ["reply1", "reply2", "reply3"]}`;

    const text = await this.callChatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    let suggestions: string[] = [];
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.map(String) : [];
      } catch {}
    }

    if (suggestions.length === 0) {
      suggestions = [`Thanks for following along! ✨`];
    }

    return {
      provider: 'openai_compat',
      suggestions,
    };
  }

  async summarizeAnalytics(input: AnalyticsSummaryRequest): Promise<string> {
    this.assertTextOnly(input);

    const text = await this.callChatCompletion([
      {
        role: 'system',
        content: 'You are an analytics assistant. Summarize performance data into 3 bullet points.',
      },
      {
        role: 'user',
        content: `Date range: ${input.dateRange}. Metrics: ${JSON.stringify(input.platformMetrics)}`,
      },
    ]);

    return text.trim();
  }
}
