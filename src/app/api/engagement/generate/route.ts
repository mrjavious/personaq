import { NextRequest, NextResponse } from 'next/server';
import { generateDraftSuggestions } from '@/lib/engagement/service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { platformAccountId, contextText } = body;

    if (!platformAccountId || !contextText || !contextText.trim()) {
      return NextResponse.json(
        { error: 'platformAccountId and contextText are required' },
        { status: 400 }
      );
    }

    const suggestions = await generateDraftSuggestions({
      platformAccountId,
      contextText: contextText.trim(),
    });

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('Error generating reply suggestions:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate drafts' },
      { status: 500 }
    );
  }
}
