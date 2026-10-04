import { GeminiProvider } from './gemini';
import { OllamaProvider } from './ollama';
import { FallbackTemplateProvider } from './fallback-template';
import { OpenAICompatProvider } from './openai-compat';
import {
  TextProvider,
  CaptionRequest,
  CaptionResult,
  ReplyRequest,
  ReplyResult,
  AnalyticsSummaryRequest,
} from './types';

export * from './types';
export * from './image-provider';
export * from './budget';
export * from './openai-compat';

export class CompositeTextProvider implements TextProvider {
  name = 'composite';
  private gemini = new GeminiProvider();
  private openaiCompat = new OpenAICompatProvider();
  private ollama = new OllamaProvider();
  private fallback = new FallbackTemplateProvider();

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async generateCaption(input: CaptionRequest): Promise<CaptionResult> {
    // 1. Try Gemini if configured
    if (await this.gemini.isAvailable()) {
      try {
        return await this.gemini.generateCaption(input);
      } catch (geminiError) {
        console.warn('Gemini caption generation failed, trying next provider:', geminiError);
      }
    }

    // 2. Try OpenAI-compatible self-hosted router (e.g. OmniRoute) if configured
    if (await this.openaiCompat.isAvailable()) {
      try {
        return await this.openaiCompat.generateCaption(input);
      } catch (routerError) {
        console.warn('OpenAI-compatible router caption generation failed, trying Ollama:', routerError);
      }
    }

    // 3. Try Ollama local model
    if (await this.ollama.isAvailable()) {
      try {
        return await this.ollama.generateCaption(input);
      } catch (ollamaError) {
        console.warn('Ollama caption generation failed, falling back to template engine:', ollamaError);
      }
    }

    // 4. Fallback to template engine
    return this.fallback.generateCaption(input);
  }

  async draftReply(input: ReplyRequest): Promise<ReplyResult> {
    if (await this.gemini.isAvailable()) {
      try {
        return await this.gemini.draftReply(input);
      } catch (e) {
        console.warn('Gemini draftReply failed, trying next provider:', e);
      }
    }

    if (await this.openaiCompat.isAvailable()) {
      try {
        return await this.openaiCompat.draftReply(input);
      } catch (e) {
        console.warn('OpenAI-compatible router draftReply failed, trying Ollama:', e);
      }
    }

    if (await this.ollama.isAvailable()) {
      try {
        return await this.ollama.draftReply(input);
      } catch (e) {
        console.warn('Ollama draftReply failed, falling back:', e);
      }
    }

    return this.fallback.draftReply(input);
  }

  async summarizeAnalytics(input: AnalyticsSummaryRequest): Promise<string> {
    if (await this.gemini.isAvailable()) {
      try {
        return await this.gemini.summarizeAnalytics(input);
      } catch (e) {
        console.warn('Gemini analytics summary failed, trying next provider:', e);
      }
    }

    if (await this.openaiCompat.isAvailable()) {
      try {
        return await this.openaiCompat.summarizeAnalytics(input);
      } catch (e) {
        console.warn('OpenAI-compatible router summarizeAnalytics failed, trying Ollama:', e);
      }
    }

    if (await this.ollama.isAvailable()) {
      try {
        return await this.ollama.summarizeAnalytics(input);
      } catch (e) {
        console.warn('Ollama analytics summary failed, falling back:', e);
      }
    }

    return this.fallback.summarizeAnalytics(input);
  }
}

export const aiTextProvider = new CompositeTextProvider();
export const compositeProvider = aiTextProvider;
export default aiTextProvider;
