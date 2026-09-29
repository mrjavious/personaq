import {
  TextProvider,
  CaptionRequest,
  CaptionResult,
  ReplyRequest,
  ReplyResult,
  AnalyticsSummaryRequest,
} from './types';
import { sanitizeCaptionOption } from './content-filter';

export class FallbackTemplateProvider implements TextProvider {
  name = 'fallback_template';

  async isAvailable(): Promise<boolean> {
    return true; // Always available
  }

  async generateCaption(input: CaptionRequest): Promise<CaptionResult> {
    const { persona, concept, platform } = input;
    const catchphrase = persona.catchphrases?.[0] || 'Digital dreams, authentic curiosity.';
    const pillar = persona.contentPillars?.[0] || 'Digital Art';

    const hashtags = [
      '#DigitalCreator',
      '#AIArtist',
      `#${persona.name.replace(/\s+/g, '')}`,
      '#AIGenerated',
      '#DisclosedAI',
    ];

    const rawOptions = [
      {
        tone: 'Witty & Engaging',
        caption: `✨ ${concept}!\n\nWhen your thoughts compile directly into pixels... ${catchphrase}\n\nWhat do you think of this visual flow? Drop your thoughts below! 👇`,
        hashtags,
        altText: `Stylized digital creation of ${persona.name} depicting ${concept}`,
        aiDisclosureIncluded: true,
      },
      {
        tone: 'Thoughtful & Technical',
        caption: `Deep dive into ${concept}.\n\nExploring new paradigms in ${pillar}. The intersection of generative workflows and human intention continues to create fascinating aesthetics.\n\n"${catchphrase}"`,
        hashtags: [...hashtags, '#CreativeTech', '#GenerativeArt'],
        altText: `Detailed digital artwork representing ${concept} with modern stylized lighting`,
        aiDisclosureIncluded: true,
      },
      {
        tone: 'Aesthetic & Minimal',
        caption: `A momentary capture: ${concept}.\n\n"${catchphrase}"`,
        hashtags: hashtags.slice(0, 3),
        altText: `Minimalist aesthetic rendering of ${persona.name}`,
        aiDisclosureIncluded: true,
      },
    ];

    const options = rawOptions.map((opt) =>
      sanitizeCaptionOption(opt, persona.aiDisclosureText, platform)
    );

    return {
      provider: 'fallback_template',
      platform,
      options,
      usedAiDisclosure: persona.aiDisclosureText,
      modelUsed: 'Persona Studio Built-in Template Engine',
    };
  }

  async draftReply(input: ReplyRequest): Promise<ReplyResult> {
    const { persona } = input;
    const catchphrase = persona.catchphrases?.[0] || 'Appreciate you!';
    return {
      provider: 'fallback_template',
      suggestions: [
        `Thank you so much! Really appreciate the kind words! ✨`,
        `Fascinating perspective! That's exactly what I was exploring with this piece. ${catchphrase}`,
        `Sending digital good vibes your way! Thanks for being part of this journey.`,
      ],
    };
  }

  async summarizeAnalytics(input: AnalyticsSummaryRequest): Promise<string> {
    return `### Weekly Persona Performance Summary
- Date Range: ${input.dateRange}
- Overview: Audience engagement on SFW channels remains healthy with strong bio-link clickthroughs.
- Strategic Recommendations:
  1. Continue testing interactive question prompts to boost comment velocity.
  2. Maintain consistent 3x weekly cadence on Instagram and X.
  3. Feature exclusive creator-tier previews to encourage funnel conversion to Fanvue.`;
  }
}
