import { NextResponse } from 'next/server';
import { getActivePersona } from '@/lib/persona/service';
import { generatePersonaVisual, VisualModelOptions } from '@/lib/persona/visual';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const persona = await getActivePersona();

    if (!persona) {
      return NextResponse.json({ error: 'No active persona found' }, { status: 404 });
    }

    const options: VisualModelOptions = {
      ethnicity: body.ethnicity || 'south_indian',
      ethnicityCustom: body.ethnicityCustom,
      styleLook: body.styleLook || 'traditional',
      bodyStructure: body.bodyStructure || 'slender',
      facialFeatures: body.facialFeatures,
      hairStyle: body.hairStyle,
      lighting: body.lighting,
      shotType: body.shotType || 'portrait',
      additionalPrompt: body.additionalPrompt,
    };

    const result = await generatePersonaVisual({
      personaId: persona.id,
      options,
      personaName: persona.name,
      adultAge: persona.adultAge,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Failed to generate persona visual:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Visual generation failed' },
      { status: 500 }
    );
  }
}
