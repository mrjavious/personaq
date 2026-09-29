import { validatePersonaGuardrails } from '@/lib/guardrails/rules';

export interface PersonaContextInput {
  name: string;
  adultAge: number;
  backstory: string;
  appearanceNotes: string;
  voiceTone: string;
  catchphrases: string[] | string;
  boundaries: string[] | string;
  contentPillars: string[] | string;
  aiDisclosureText: string;
}

/**
 * Builds the authoritative AI System Context prompt for a persona.
 * This prompt is injected into every downstream AI text request (caption assistant, reply drafter, analytics).
 * Enforces Section 2 Guardrails:
 * - Disclosed fictional AI identity
 * - Explicit mature adult persona (>= 25)
 * - Strict prohibition of minor depictions or real-person simulation
 */
export function buildPersonaSystemPrompt(persona: PersonaContextInput): string {
  // Validate guardrails before compiling prompt
  const guardrailCheck = validatePersonaGuardrails({
    adultAge: persona.adultAge,
    aiDisclosureText: persona.aiDisclosureText,
    name: persona.name,
  });

  if (!guardrailCheck.valid) {
    throw new Error(`Guardrail violation in Persona Bible: ${guardrailCheck.errors.join('; ')}`);
  }

  const parsedCatchphrases: string[] = Array.isArray(persona.catchphrases)
    ? persona.catchphrases
    : typeof persona.catchphrases === 'string'
    ? JSON.parse(persona.catchphrases || '[]')
    : [];

  const parsedBoundaries: string[] = Array.isArray(persona.boundaries)
    ? persona.boundaries
    : typeof persona.boundaries === 'string'
    ? JSON.parse(persona.boundaries || '[]')
    : [];

  const parsedPillars: string[] = Array.isArray(persona.contentPillars)
    ? persona.contentPillars
    : typeof persona.contentPillars === 'string'
    ? JSON.parse(persona.contentPillars || '[]')
    : [];

  return `### SYSTEM CONTEXT: AI PERSONA BIBLE
You are generating text as or on behalf of the disclosed fictional AI persona "${persona.name}".

#### 1. CORE IDENTITY & MANDATORY GUARDRAILS
- IDENTITY: Fictional, AI-generated digital creator. NEVER claim or pretend to be a real human person.
- AGE: Adult (${persona.adultAge} years old). NEVER depict, reference, or simulate minors, underage themes, or youthful personas under any circumstance.
- MANDATORY AI DISCLOSURE: "${persona.aiDisclosureText}"
- SAFETY: Strict platform compliance. No explicit or non-compliant content on public social queues.

#### 2. PERSONA BACKSTORY & CONTEXT
${persona.backstory}

#### 3. APPEARANCE & AESTHETIC GUIDELINES
${persona.appearanceNotes}

#### 4. VOICE, TONE & MANNERISMS
- Tone: ${persona.voiceTone}
${parsedCatchphrases.length > 0 ? `- Signature Catchphrases / Expressions:\n  ${parsedCatchphrases.map((c) => `* "${c}"`).join('\n  ')}` : ''}

#### 5. CONTENT PILLARS
${parsedPillars.map((p, i) => `${i + 1}. ${p}`).join('\n')}

#### 6. STRICT BOUNDARIES & NEGATIVE CONSTRAINTS (DO NOT VIOLATE)
${parsedBoundaries.map((b) => `- ${b}`).join('\n')}
- Never break character in an un-disclosed manner.
- Never simulate real-world tragedy, private relationships, or living public figures.
- Adhere strictly to the chosen platform's formatting and length requirements.`;
}
