/**
 * Free Public APIs Service (Curated from https://www.getfreeapis.com/)
 *
 * Integrates verified, free-tier and keyless public APIs for:
 * 1. Agify.io - Demographic age inference from persona name (no key required).
 * 2. The Color API - Dynamic color harmonies and palettes for visual model styling (no key required).
 * 3. Jina AI Reader - Clean markdown web extraction for grounding persona knowledge (no key required).
 * 4. Pollinations.ai - Zero-key serverless text and prompt completion fallback.
 */

export interface DemographicAgeEstimate {
  name: string;
  suggestedAge: number;
  sampleCount: number;
  source: 'agify.io' | 'local_fallback';
}

export interface PersonaColorPalette {
  seed: string;
  schemeMode: string;
  colors: Array<{
    hex: string;
    name: string;
    rgb: string;
    contrast: string;
  }>;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  source: 'thecolorapi.com' | 'local_fallback';
}

/**
 * 1. Agify.io API Integration
 * Infers demographic age statistics based on persona first name.
 * Ideal for suggesting realistic adult ages and verifying consistency.
 */
export async function getDemographicAgeEstimate(name: string): Promise<DemographicAgeEstimate> {
  const firstName = name.trim().split(/\s+/)[0] || 'Alex';
  try {
    const res = await fetch(`https://api.agify.io?name=${encodeURIComponent(firstName)}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const data = await res.json();
      const rawAge = typeof data.age === 'number' ? data.age : 25;
      // Guardrail: Always enforce adult threshold (>= 21)
      const suggestedAge = Math.max(21, rawAge);
      return {
        name: firstName,
        suggestedAge,
        sampleCount: data.count || 0,
        source: 'agify.io',
      };
    }
  } catch {
    // Graceful fallback to default adult age
  }

  return {
    name: firstName,
    suggestedAge: 24,
    sampleCount: 0,
    source: 'local_fallback',
  };
}

/**
 * 2. The Color API Integration
 * Generates aesthetic, harmonious brand palettes for persona visual identity.
 */
export async function getPersonaColorPalette(
  seedHex = '38bdf8',
  mode: 'analogic' | 'monochrome' | 'triad' | 'complement' = 'analogic'
): Promise<PersonaColorPalette> {
  const cleanHex = seedHex.replace(/^#/, '').trim() || '38bdf8';

  try {
    const res = await fetch(
      `https://www.thecolorapi.com/scheme?hex=${cleanHex}&mode=${mode}&count=5`,
      {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (res.ok) {
      const data = await res.json();
      const colors = (data.colors || []).map((c: { hex?: { value: string }; name?: { value: string }; rgb?: { value: string }; contrast?: { value: string } }) => ({
        hex: c.hex?.value || '#38bdf8',
        name: c.name?.value || 'Color',
        rgb: c.rgb?.value || 'rgb(56, 189, 248)',
        contrast: c.contrast?.value || '#000000',
      }));

      if (colors.length >= 3) {
        return {
          seed: `#${cleanHex}`,
          schemeMode: mode,
          colors,
          primary: colors[0].hex,
          secondary: colors[1].hex,
          accent: colors[2].hex,
          background: colors[colors.length - 1].hex,
          source: 'thecolorapi.com',
        };
      }
    }
  } catch {
    // Fall through to curated palette fallback
  }

  return {
    seed: `#${cleanHex}`,
    schemeMode: mode,
    colors: [
      { hex: '#38bdf8', name: 'Sky Blue', rgb: 'rgb(56, 189, 248)', contrast: '#000000' },
      { hex: '#818cf8', name: 'Indigo Accent', rgb: 'rgb(129, 140, 248)', contrast: '#000000' },
      { hex: '#c084fc', name: 'Purple Highlight', rgb: 'rgb(192, 132, 252)', contrast: '#000000' },
      { hex: '#0f172a', name: 'Slate Dark', rgb: 'rgb(15, 23, 42)', contrast: '#ffffff' },
    ],
    primary: '#38bdf8',
    secondary: '#818cf8',
    accent: '#c084fc',
    background: '#0f172a',
    source: 'local_fallback',
  };
}

/**
 * 3. Jina AI Reader Integration
 * Extracts clean, LLM-ready markdown from web articles for grounding persona posts.
 */
export async function extractArticleMarkdown(url: string): Promise<string> {
  if (!url || !url.startsWith('http')) {
    throw new Error('Valid HTTP/HTTPS URL required');
  }

  try {
    const res = await fetch(`https://r.jina.ai/${encodeURI(url)}`, {
      headers: {
        Accept: 'text/markdown,text/plain',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      const text = await res.text();
      return text.slice(0, 4000); // Truncate to reasonable context window
    }
  } catch (err) {
    console.warn('Jina AI extraction failed:', err);
  }

  return '';
}

/**
 * 4. Pollinations.ai Text Generation
 * Keyless public LLM endpoint for prompt expansions and creative ideas.
 */
export async function generatePollinationsText(prompt: string): Promise<string> {
  try {
    const cleanPrompt = encodeURIComponent(prompt.slice(0, 500));
    const res = await fetch(`https://text.pollinations.ai/${cleanPrompt}?model=mistral`, {
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      return (await res.text()).trim();
    }
  } catch (err) {
    console.warn('Pollinations text generation failed:', err);
  }
  return '';
}
