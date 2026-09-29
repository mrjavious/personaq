import { CaptionOption } from './types';

export interface FilterResult {
  passed: boolean;
  filteredText: string;
  violations: string[];
}

const FORBIDDEN_WORDS = [
  // Minor guardrails
  'underage',
  'teenager',
  'schoolgirl',
  'minor',
  'child',
  'lolita',
  // Explicit / non-compliant text for social platforms
  'nude',
  'naked',
  'porn',
  'onlyfans',
  'nsfw',
  'xxx',
  'sex',
];

/**
 * Validates and filters AI-generated text to enforce boundaries and SFW compliance.
 */
export function filterAiText(text: string): FilterResult {
  const lower = text.toLowerCase();
  const violations: string[] = [];

  for (const word of FORBIDDEN_WORDS) {
    // Regex matching word boundary
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(lower)) {
      violations.push(`Contained prohibited word: "${word}"`);
    }
  }

  return {
    passed: violations.length === 0,
    filteredText: text,
    violations,
  };
}

/**
 * Sanitizes and verifies caption options
 */
export function sanitizeCaptionOption(
  option: CaptionOption,
  defaultDisclosure: string,
  platform: string
): CaptionOption {
  let caption = option.caption;

  // Enforce AI Disclosure if missing
  const hasDisclosure =
    caption.includes('#AI') ||
    caption.includes('AI persona') ||
    caption.includes('AI-generated') ||
    caption.includes(defaultDisclosure);

  if (!hasDisclosure) {
    if (platform === 'x') {
      caption = `${caption}\n\n#AI #DisclosedAI`;
    } else {
      caption = `${caption}\n\n---\n${defaultDisclosure}`;
    }
  }

  return {
    ...option,
    caption,
    aiDisclosureIncluded: true,
  };
}
