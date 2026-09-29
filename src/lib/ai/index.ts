import { GeminiProvider } from './gemini';
import { OllamaProvider } from './ollama';
import { FallbackTemplateProvider } from './fallback-template';
import {
  TextProvider,
  CaptionRequest,
  CaptionResult,
  ReplyRequest,
  ReplyResult,
  AnalyticsSummaryRequest,
} from './types';

export class CompositeTextProvider implements TextProvider {
  name = 'composite';
  private gemini = new GeminiProvider();
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
        console.warn('Gemini caption generation failed, falling back to Ollama:', geminiError);
      }
    }

    // 2. Try Ollama local model
    if (await this.ollama.isAvailable()) {
      try {
        return await this.ollama.generateCaption(input);
      } catch (ollamaError) {
        console.warn('Ollama caption generation failed, falling back to template engine:', ollamaError);
      }
    }

    // 3. Fallback to template engine
    return this.fallback.generateCaption(input);
  }

  async draftReply(input: ReplyRequest): Promise<ReplyResult> {
    if (await this.gemini.isAvailable()) {
      try {
        return await this.gemini.draftReply(input);
      } catch (e) {
        console.warn('Gemini draftReply failed, falling back:', e);
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
        console.warn('Gemini analytics summary failed, falling back:', e);
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
