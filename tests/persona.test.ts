import { describe, it, expect } from 'vitest';
import { buildPersonaSystemPrompt } from '@/lib/persona/prompt';
import { validatePersonaGuardrails } from '@/lib/guardrails/rules';

describe('Persona Bible & Prompt Context (Phase 1)', () => {
  const validPersona = {
    name: 'Aria Nova',
    adultAge: 26,
    backstory: 'Aria is a digital artist living in Neo-Arcadia.',
    appearanceNotes: 'Stylized violet eyes, silver bob, clearly digital aesthetic.',
    voiceTone: 'Thoughtful, curious, witty, approachable.',
    catchphrases: ['Pixels into imagination', 'Code meets beauty'],
    boundaries: ['Never simulate real grief', 'No minor depictions'],
    contentPillars: ['Digital Art', 'Workflows'],
    aiDisclosureText: '✨ Disclosed Fictional AI Persona: Created with generative AI tools.',
  };

  it('should compile an authoritative AI system prompt containing all guardrails', () => {
    const prompt = buildPersonaSystemPrompt(validPersona);

    // Verify Adult Guardrail
    expect(prompt).toContain('Adult (26 years old)');
    expect(prompt).toContain('NEVER depict, reference, or simulate minors');

    // Verify AI Disclosure Guardrail
    expect(prompt).toContain('MANDATORY AI DISCLOSURE');
    expect(prompt).toContain('✨ Disclosed Fictional AI Persona');

    // Verify Fictional Identity Guardrail
    expect(prompt).toContain('Fictional, AI-generated digital creator');
    expect(prompt).toContain('NEVER claim or pretend to be a real human person');

    // Verify Persona Voice & Context
    expect(prompt).toContain('Aria is a digital artist living in Neo-Arcadia.');
    expect(prompt).toContain('Thoughtful, curious, witty, approachable.');
    expect(prompt).toContain('Pixels into imagination');
    expect(prompt).toContain('Never simulate real grief');
  });

  it('should refuse to generate system prompt if persona has guardrail violations', () => {
    expect(() =>
      buildPersonaSystemPrompt({
        ...validPersona,
        adultAge: 16, // Minor violation
      })
    ).toThrow(/Guardrail violation/);

    expect(() =>
      buildPersonaSystemPrompt({
        ...validPersona,
        aiDisclosureText: '', // Missing disclosure
      })
    ).toThrow(/Guardrail violation/);
  });

  it('should validate persona fields with validatePersonaGuardrails', () => {
    const invalidAge = validatePersonaGuardrails({
      adultAge: 17,
      aiDisclosureText: 'Valid disclosure',
    });
    expect(invalidAge.valid).toBe(false);
    expect(invalidAge.errors[0]).toContain('Minors are strictly prohibited');

    const missingDisclosure = validatePersonaGuardrails({
      adultAge: 27,
      aiDisclosureText: '',
    });
    expect(missingDisclosure.valid).toBe(false);
    expect(missingDisclosure.errors[0]).toContain('AI disclosure text is mandatory');
  });
});
