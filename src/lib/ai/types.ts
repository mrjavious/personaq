export interface CaptionRequest {
  concept: string;
  platform: 'instagram' | 'x' | 'threads' | 'tiktok' | 'fanvue' | string;
  persona: {
    name: string;
    adultAge: number;
    backstory: string;
    voiceTone: string;
    catchphrases: string[];
    boundaries: string[];
    contentPillars: string[];
    aiDisclosureText: string;
  };
  assetDescription?: string;
  targetAudience?: string;
}

export interface CaptionOption {
  tone: 'Witty & Engaging' | 'Thoughtful & Technical' | 'Aesthetic & Minimal' | string;
  caption: string;
  hashtags: string[];
  altText: string;
  aiDisclosureIncluded: boolean;
}

export interface CaptionResult {
  provider: 'openai_compat' | 'ollama' | 'fallback_template';
  platform: string;
  options: CaptionOption[];
  usedAiDisclosure: string;
  modelUsed: string;
}

export interface ReplyRequest {
  contextText: string; // The fan comment or DM
  platform: string;
  persona: {
    name: string;
    voiceTone: string;
    catchphrases: string[];
    boundaries: string[];
  };
}

export interface ReplyResult {
  provider: string;
  suggestions: string[];
}

export interface AnalyticsSummaryRequest {
  platformMetrics: Record<string, unknown>;
  dateRange: string;
}

export interface TextProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  generateCaption(input: CaptionRequest): Promise<CaptionResult>;
  draftReply(input: ReplyRequest): Promise<ReplyResult>;
  summarizeAnalytics(input: AnalyticsSummaryRequest): Promise<string>;
}
