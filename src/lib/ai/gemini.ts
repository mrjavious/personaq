import { GoogleGenAI } from '@google/genai';
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

export class GeminiProvider implements TextProvider {
  name = 'gemini';
  private client: GoogleGenAI | null = null;
  private modelName = 'gemini-2.5-flash';

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey.trim().length > 5) {
      this.client = new GoogleGenAI({ apiKey });
    }
  }

  async isAvailable(): Promise<boolean> {
    const key = process.env.GEMINI_API_KEY;
    return Boolean(key && key.trim().length > 5);
  }

  /**
   * Helper executing prompt with exponential backoff for rate limits (HTTP 429)
   */
  private async executeWithRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 1000): Promise<T> {
    try {
      return await fn();
    } catch (error: unknown) {
      const isRateLimit =
        error instanceof Error &&
        (error.message.includes('429') ||
          error.message.includes('RESOURCE_EXHAUSTED') ||
          error.message.includes('quota'));

      if (retries > 0 && isRateLimit) {
        console.warn(`Gemini rate limited. Retrying in ${delayMs}ms... (${retries} left)`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return this.executeWithRetry(fn, retries - 1, delayMs * 2);
      }
      throw error;
    }
  }

  async generateCaption(input: CaptionRequest): Promise<CaptionResult> {
    if (!this.client) {
      throw new Error('Gemini API key is not configured');
    }

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

    const userPrompt = `Generate 3 distinct social media caption options for ${input.platform}.
Post Concept: "${input.concept}"
${input.assetDescription ? `Visual Scene: "${input.assetDescription}"` : ''}

Platform constraints:
- Platform: ${input.platform}
${input.platform === 'x' ? '- Max length: strictly under 280 characters' : '- Include structured line breaks and storytelling'}
- Include relevant hashtags
- Suggest descriptive accessibility alt-text for the image
- NEVER generate explicit, non-compliant, or underage themes

Respond strictly with valid JSON conforming to this schema:
{
  "options": [
    {
      "tone": "Witty & Engaging",
      "caption": "caption text here",
      "hashtags": ["#tag1", "#tag2"],
      "altText": "Visual description for screen readers"
    },
    {
      "tone": "Thoughtful & Technical",
      "caption": "caption text here",
      "hashtags": ["#tag1", "#tag2"],
      "altText": "Visual description for screen readers"
    },
    {
      "tone": "Aesthetic & Minimal",
      "caption": "caption text here",
      "hashtags": ["#tag1", "#tag2"],
      "altText": "Visual description for screen readers"
    }
  ]
}`;

    const rawResponse = await this.executeWithRetry(async () => {
      const response = await this.client!.models.generateContent({
        model: this.modelName,
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\n---\n\n${userPrompt}` }] },
        ],
        config: {
          responseMimeType: 'application/json',
          temperature: 0.7,
        },
      });
      return response.text || '';
    });

    let parsed: { options: Array<{ tone: string; caption: string; hashtags: string[]; altText: string }> };
    try {
      parsed = JSON.parse(rawResponse);
    } catch {
      // Clean markdown code blocks if present
      const cleanJson = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleanJson);
    }

    // Pass through Content Filter
    const options = (parsed.options || []).map((opt) => {
      const filter = filterAiText(opt.caption);
      if (!filter.passed) {
        throw new Error(`Content filter violation in generated caption: ${filter.violations.join(', ')}`);
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
      provider: 'gemini',
      platform: input.platform,
      options,
      usedAiDisclosure: input.persona.aiDisclosureText,
      modelUsed: this.modelName,
    };
  }

  async draftReply(input: ReplyRequest): Promise<ReplyResult> {
    if (!this.client) throw new Error('Gemini API key is not configured');

    const prompt = `As persona "${input.persona.name}" (Voice tone: ${input.persona.voiceTone}), draft 3 short, friendly, and distinct replies to this comment on ${input.platform}:
Comment: "${input.contextText}"

Boundaries:
- Never claim to be a real living person.
- Friendly, warm, transparently digital.
- Human-in-the-loop: these are suggestions for the creator to approve.

Respond with JSON: { "suggestions": ["reply 1", "reply 2", "reply 3"] }`;

    const raw = await this.executeWithRetry(async () => {
      const res = await this.client!.models.generateContent({
        model: this.modelName,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseMimeType: 'application/json' },
      });
      return res.text || '{}';
    });

    const parsed = JSON.parse(raw);
    return {
      provider: 'gemini',
      suggestions: parsed.suggestions || [],
    };
  }

  async summarizeAnalytics(input: AnalyticsSummaryRequest): Promise<string> {
    if (!this.client) throw new Error('Gemini API key is not configured');

    const prompt = `Summarize these creator analytics for ${input.dateRange}:
${JSON.stringify(input.platformMetrics, null, 2)}
Provide concise top takeaways and 3 strategic recommendations for SFW social growth and funnel conversion to Fanvue.`;

    const res = await this.executeWithRetry(async () => {
      const response = await this.client!.models.generateContent({
        model: this.modelName,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });
      return response.text || '';
    });

    return res;
  }
}
