import {
  TextProvider,
  CaptionRequest,
  CaptionResult,
  ReplyRequest,
  ReplyResult,
  AnalyticsSummaryRequest,
} from './types';
import { buildPersonaSystemPrompt } from '@/lib/persona/prompt';
import { filterAiText, sanitizeCaptionOption } from './content-filter';

export class OllamaProvider implements TextProvider {
  name = 'ollama';
  private baseUrl: string;
  private model: string;

  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.model = process.env.OLLAMA_MODEL || 'llama3';
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(1500),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async generateCaption(input: CaptionRequest): Promise<CaptionResult> {
    const systemPrompt = buildPersonaSystemPrompt({
      name: input.persona.name,
      adultAge: input.persona.adultAge,
      backstory: input.persona.backstory,
      appearanceNotes: '',
      voiceTone: input.persona.voiceTone,
      catchphrases: input.persona.catchphrases,
      boundaries: input.persona.boundaries,
      contentPillars: input.persona.contentPillars,
      aiDisclosureText: input.persona.aiDisclosureText,
    });

    const prompt = `${systemPrompt}\n\nGenerate 3 distinct captions for ${input.platform} about "${input.concept}".
Format response strictly as JSON with keys: options: [{ "tone", "caption", "hashtags": [], "altText" }]`;

    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt,
        format: 'json',
        stream: false,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      throw new Error(`Ollama generation failed with status ${res.status}`);
    }

    const data = await res.json();
    let parsed: { options: Array<{ tone: string; caption: string; hashtags: string[]; altText: string }> };

    try {
      parsed = JSON.parse(data.response);
    } catch {
      const clean = (data.response || '').replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(clean);
    }

    const options = (parsed.options || []).map((opt) => {
      const filter = filterAiText(opt.caption);
      if (!filter.passed) {
        throw new Error(`Content filter violation in Ollama caption: ${filter.violations.join(', ')}`);
      }
      return sanitizeCaptionOption(
        {
          tone: opt.tone,
          caption: opt.caption,
          hashtags: opt.hashtags || [],
          altText: opt.altText || '',
          aiDisclosureIncluded: true,
        },
        input.persona.aiDisclosureText,
        input.platform
      );
    });

    return {
      provider: 'ollama',
      platform: input.platform,
      options,
      usedAiDisclosure: input.persona.aiDisclosureText,
      modelUsed: this.model,
    };
  }

  async draftReply(input: ReplyRequest): Promise<ReplyResult> {
    const prompt = `As persona "${input.persona.name}", write 3 short, friendly suggested replies to this fan comment: "${input.contextText}". Format as JSON: { "suggestions": [] }`;

    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, prompt, format: 'json', stream: false }),
    });

    const data = await res.json();
    const parsed = JSON.parse(data.response);
    return {
      provider: 'ollama',
      suggestions: parsed.suggestions || [],
    };
  }

  async summarizeAnalytics(input: AnalyticsSummaryRequest): Promise<string> {
    const prompt = `Summarize analytics: ${JSON.stringify(input.platformMetrics)}. Provide 3 growth recommendations.`;
    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, prompt, stream: false }),
    });
    const data = await res.json();
    return data.response || '';
  }
}
