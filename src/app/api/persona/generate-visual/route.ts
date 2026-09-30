import { NextResponse } from 'next/server';
import { getActivePersona, getPersonaById } from '@/lib/persona/service';
import { generatePersonaVisual, VisualModelOptions } from '@/lib/persona/visual';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Look up target persona by body.personaId if provided, otherwise active persona
    let persona = null;
    if (body.personaId) {
      persona = await getPersonaById(body.personaId);
    }
    if (!persona) {
      persona = await getActivePersona();
    }

    if (!persona) {
      return NextResponse.json({ error: 'No active persona found' }, { status: 404 });
    }

    // Parse options with persona-specific defaults
    let personaConfig: Partial<VisualModelOptions> = {};
    try {
      if (persona.visualModelConfig) {
        personaConfig = JSON.parse(persona.visualModelConfig);
      }
    } catch {
      // ignore
    }

    // Default ethnicity: use body, or personaConfig, or infer from persona name if not south_indian
    let defaultEthnicity: VisualModelOptions['ethnicity'] = 'south_indian';
    if (personaConfig.ethnicity) {
      defaultEthnicity = personaConfig.ethnicity;
    } else {
      const lowerName = persona.name.toLowerCase();
      if (lowerName.includes('elena') || lowerName.includes('vance') || lowerName.includes('sophie') || lowerName.includes('emma')) {
        defaultEthnicity = 'caucasian';
      } else if (lowerName.includes('jenni') || lowerName.includes('mol') || lowerName.includes('priya') || lowerName.includes('meenakshi') || lowerName.includes('aarav')) {
        defaultEthnicity = 'south_indian';
      }
    }

    const options: VisualModelOptions = {
      ethnicity: body.ethnicity || defaultEthnicity,
      ethnicityCustom: body.ethnicityCustom,
      styleLook: body.styleLook || personaConfig.styleLook || 'minimal_studio',
      bodyStructure: body.bodyStructure || personaConfig.bodyStructure || 'hourglass',
      facialFeatures: body.facialFeatures,
      hairStyle: body.hairStyle,
      lighting: body.lighting,
      shotType: body.shotType || personaConfig.shotType || 'portrait',
      additionalPrompt: body.additionalPrompt,
      referenceImageUrl: undefined, // Never inherit stale reference image from another persona
      cameraAngle: body.cameraAngle || 'front',
      faceCard: body.faceCard,
      dimple: body.dimple,
      skinTone: body.skinTone,
      distinctiveMarks: body.distinctiveMarks,
      bodyProportions: body.bodyProportions,
      tattoos: body.tattoos,
      hairStyling: body.hairStyling,
      isFaceLocked: typeof body.isFaceLocked === 'boolean' ? body.isFaceLocked : personaConfig.isFaceLocked,
      lockedFaceUrl: body.lockedFaceUrl || personaConfig.lockedFaceUrl,
    };

    const result = await generatePersonaVisual({
      personaId: persona.id,
      options,
      personaName: body.personaName || persona.name,
      adultAge: body.adultAge || persona.adultAge,
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
