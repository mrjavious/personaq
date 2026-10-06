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
  private openaiCompat = new OpenAICompatProvider();
  private ollama = new OllamaProvider();
  private fallback = new FallbackTemplateProvider();

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async generateCaption(input: CaptionRequest): Promise<CaptionResult> {
    // 1. Try OpenAI-compatible cloud router (Groq, OmniRoute, vLLM) if configured
    if (await this.openaiCompat.isAvailable()) {
      try {
        return await this.openaiCompat.generateCaption(input);
      } catch (routerError) {
        console.warn('OpenAI-compatible router caption generation failed, trying next provider:', routerError);
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
    if (await this.openaiCompat.isAvailable()) {
      try {
        return await this.openaiCompat.draftReply(input);
      } catch (e) {
        console.warn('OpenAI-compatible router draftReply failed, trying next provider:', e);
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
    if (await this.openaiCompat.isAvailable()) {
      try {
        return await this.openaiCompat.summarizeAnalytics(input);
      } catch (e) {
        console.warn('OpenAI-compatible router summarizeAnalytics failed, trying next provider:', e);
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

export const compositeProvider = new CompositeTextProvider();

let defaultTextProvider: TextProvider | null = null;

export function getTextProvider(): TextProvider {
  if (!defaultTextProvider) {
    defaultTextProvider = compositeProvider;
  }
  return defaultTextProvider;
}

export function setTextProvider(provider: TextProvider): void {
  defaultTextProvider = provider;
}

export default compositeProvider;
