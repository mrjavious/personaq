import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/handler';
import {
  getDemographicAgeEstimate,
  getPersonaColorPalette,
  extractArticleMarkdown,
  generatePollinationsText,
} from '@/lib/free-apis';
import { z } from 'zod';

const EnhanceRequestSchema = z.object({
  action: z.enum(['estimate_age', 'color_palette', 'extract_article', 'suggest_ideas']),
  name: z.string().optional(),
  seedHex: z.string().optional(),
  colorMode: z.enum(['analogic', 'monochrome', 'triad', 'complement']).optional(),
  url: z.string().url().optional(),
  prompt: z.string().optional(),
});

export const POST = withApi(
  async (request: Request) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body', success: false }, { status: 400 });
    }

    const parseResult = EnhanceRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid enhance parameters', details: parseResult.error.flatten(), success: false },
        { status: 400 }
      );
    }

    const { action, name, seedHex, colorMode, url, prompt } = parseResult.data;

    switch (action) {
      case 'estimate_age': {
        const estimate = await getDemographicAgeEstimate(name || 'Alex');
        return NextResponse.json({ success: true, data: estimate });
      }

      case 'color_palette': {
        const palette = await getPersonaColorPalette(seedHex || '38bdf8', colorMode || 'analogic');
        return NextResponse.json({ success: true, data: palette });
      }

      case 'extract_article': {
        if (!url) {
          return NextResponse.json({ error: 'URL required for article extraction', success: false }, { status: 400 });
        }
        const markdown = await extractArticleMarkdown(url);
        return NextResponse.json({ success: true, data: { url, markdown } });
      }

      case 'suggest_ideas': {
        const suggestion = await generatePollinationsText(prompt || 'Exciting creative AI persona themes');
        return NextResponse.json({ success: true, data: { suggestion } });
      }

      default:
        return NextResponse.json({ error: 'Unsupported action', success: false }, { status: 400 });
    }
  },
  { permission: 'manage_persona' }
);
