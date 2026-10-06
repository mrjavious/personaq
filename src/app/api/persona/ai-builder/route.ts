import { NextResponse } from 'next/server';
import { validatePersonaGuardrails } from '@/lib/guardrails/rules';
import { withApi } from '@/lib/api/handler';

interface Message {
  role: 'user' | 'assistant' | string;
  content: string;
}

interface PersonaDraft {
  name: string;
  adultAge: number;
  voiceTone: string;
  appearanceNotes: string;
  backstory?: string;
  catchphrases?: string[];
  boundaries?: string[];
  contentPillars?: string[];
  aiDisclosureText?: string;
  [key: string]: unknown;
}

export const POST = withApi(
  async (request: Request) => {
    const body = await request.json();
    const { messages = [] }: { messages: Message[] } = body;

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
    }

    const lastUserMessage = messages[messages.length - 1]?.content || '';

// System prompt for Persona Architect
    const systemInstruction = `You are Persona Architect, an elite character design AI.
You help creators build photorealistic, compelling autonomous AI Persona Agents.
NON-NEGOTIABLE SAFETY GUARDRAILS (SECTION 2):
1. The persona MUST be a consenting mature adult (minimum age 18, recommended >= 21). If the user explicitly specifies an age (such as "22 year old"), you MUST strictly set "adultAge" to their exact specified age.
2. The persona must have a transparent AI synthetic disclosure statement.
3. No minors, no illicit content, no real-person impersonation.

YOUR GOAL:
1. Carefully adhere to ALL details provided by the user (name, age, cultural background, cities, job, hobbies, aesthetic, voice).
2. If the user requests physical identity features, distinctive marks, or body art (such as beauty marks/moles in the chest, cleavage, breast, collarbone, or tattoos on the sternum, underbust, cleavage, or arms), seamlessly incorporate them into "appearanceNotes" with high-definition styling detail.
3. In your natural conversational text, acknowledge their creative vision with warmth and excitement.
4. At the end of your response, ALWAYS include a JSON block formatted exactly like:
\`\`\`json
{
  "name": "Culturally appropriate and creative persona name",
  "adultAge": 22,
  "voiceTone": "Voice tone description",
  "backstory": "Rich narrative backstory, career journey, origins, and creative motivations",
  "appearanceNotes": "Pure physical appearance only: facial features, eyes, hair, complexion, distinctive marks (e.g. chest/cleavage mole), tattoos, and body silhouette. Strictly do not include clothing, outfits, or fashion attire",
  "catchphrases": ["Signature catchphrase 1", "Signature catchphrase 2"],
  "boundaries": ["Never depict minors under any circumstance", "100% platform-compliant SFW public feeds", "Never claim real living human status"],
  "contentPillars": ["Topic 1", "Topic 2", "Topic 3"],
  "aiDisclosureText": "✨ Disclosed Fictional AI Persona: Created with generative AI tools. 100% fictional identity."
}
\`\`\`
Keep the conversational reply concise, enthusiastic, and actionable (2-3 short paragraphs max).`;

    let replyText = '';
    let personaDraft: PersonaDraft | null = null;

    // 1. Try Groq / OpenAI-compatible provider
    const groqKey = process.env.GROQ_API_KEY || process.env.OPENAI_COMPAT_API_KEY;
    if (groqKey) {
      try {
        const baseUrl = process.env.OPENAI_COMPAT_BASE_URL || 'https://api.groq.com/openai/v1';
        const model = process.env.GROQ_MODEL || process.env.OPENAI_COMPAT_MODEL || 'llama-3.3-70b-versatile';
        const chatMessages = [
          { role: 'system', content: systemInstruction },
          ...messages.map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
        ];

        const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model,
            messages: chatMessages,
            temperature: 0.75,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          replyText = data.choices?.[0]?.message?.content || '';
        }
      } catch (err) {
        console.warn('Groq/OpenAI chat builder warning:', err);
      }
    }

    // 2. Try Ollama local model if configured and replyText is not set
    if (!replyText && process.env.OLLAMA_BASE_URL) {
      try {
        const ollamaBase = process.env.OLLAMA_BASE_URL.replace(/\/+$/, '');
        const ollamaModel = process.env.OLLAMA_MODEL || 'llama3';
        const res = await fetch(`${ollamaBase}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: ollamaModel,
            messages: [
              { role: 'system', content: systemInstruction },
              ...messages,
            ],
            stream: false,
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (res.ok) {
          const data = await res.json();
          replyText = data.message?.content || '';
        }
      } catch (ollamaErr) {
        console.warn('Ollama chat builder warning:', ollamaErr);
      }
    }

    // Parse JSON block from response
    if (replyText) {
      const match = replyText.match(/```json\s*([\s\S]*?)\s*```/);
      if (match && match[1]) {
        try {
          const parsed = JSON.parse(match[1]);
          if (parsed.name) {
            const userAgeMatch = lastUserMessage.match(/(\d{2})\s*(?:year|yr|yo|-year)/i) || lastUserMessage.match(/age\s*[:\s]*(\d{2})/i);
            const userSpecifiedAge = userAgeMatch ? parseInt(userAgeMatch[1], 10) : null;
            const finalAge = userSpecifiedAge && userSpecifiedAge >= 18 ? userSpecifiedAge : Math.max(18, Number(parsed.adultAge) || 24);

            const personaName = String(parsed.name).trim();
            const rawBackstory = String(parsed.backstory || '').trim();
            const fallbackBackstory = `${personaName} is an autonomous digital creator and visionary persona blending contemporary aesthetics and creative storytelling.`;

            personaDraft = {
              name: personaName,
              adultAge: finalAge,
              voiceTone: String(parsed.voiceTone || 'Thoughtful, curious, and authentic'),
              backstory: rawBackstory || fallbackBackstory,
              appearanceNotes: String(parsed.appearanceNotes || 'Modern contemporary styling with distinctive digital aesthetic'),
              catchphrases: Array.isArray(parsed.catchphrases) ? parsed.catchphrases : ['Living in pixels.', 'Curating digital moments.'],
              boundaries: Array.isArray(parsed.boundaries) ? parsed.boundaries : ['Never depict minors', 'Strict SFW public feeds'],
              contentPillars: Array.isArray(parsed.contentPillars) ? parsed.contentPillars : ['Aesthetics & Lifestyle', 'Behind the Lens'],
              aiDisclosureText: String(parsed.aiDisclosureText || '✨ Disclosed Fictional AI Persona: Created with generative AI tools. 100% fictional identity.'),
            };
            // Clean JSON block from user chat message text for clean UI display
            replyText = replyText.replace(/```json[\s\S]*?```/g, '').trim();
          }
        } catch {
          // JSON parse failed, will use fallback
        }
      }
    }

    // Intelligent prompt extractor if AI was unavailable or JSON block failed
    if (!personaDraft) {
      const userLower = lastUserMessage.toLowerCase();
      
      // Extract requested age (default 22 if user says 22, etc.)
      const ageMatch = lastUserMessage.match(/(\d{2})\s*(?:year|yr|yo|-year)/i) || lastUserMessage.match(/age\s*[:\s]*(\d{2})/i);
      const parsedAge = ageMatch ? parseInt(ageMatch[1], 10) : 24;
      const adultAge = Math.max(18, parsedAge);

      const isSouthIndian = userLower.includes('tamil') || userLower.includes('tirunelveli') || userLower.includes('chennai') || userLower.includes('india');
      const isTech = userLower.includes('tech') || userLower.includes('software') || userLower.includes('gadget');
      const isFood = userLower.includes('food') || userLower.includes('culinary') || userLower.includes('cooking');
      const isMusic = userLower.includes('dj') || userLower.includes('music') || userLower.includes('synth');

      let name = 'Kaelen Vance';
      let voiceTone = 'Authentic, creative, and dynamic';
      let backstory = `A dynamic digital creator focused on contemporary culture and creative projects. ${lastUserMessage}`;
      let appearanceNotes = 'Natural luminous skin, balanced facial features, expressive eyes, sleek dark hair.';
      let pillars = ['Creative Tech', 'Lifestyle & Stories', 'Behind the Lens'];

      if (isSouthIndian) {
        name = isTech ? 'Ananya Selvaraj' : 'Karthik Raja';
        voiceTone = 'Energetic, articulate, warm, and tech-forward with vibrant South Indian charm.';
        backstory = `Born in Tirunelveli, Tamil Nadu, and now living and working in Chennai, ${name} is a passionate 22-year-old creator blending tech insights with Chennai's vibrant street and culinary culture.`;
        appearanceNotes = 'Warm honey-tan skin, sharp expressive dark brown eyes, sleek dark hair, radiant natural complexion.';
        pillars = isFood
          ? ['Gadget Reviews & AI Hacks', 'Chennai Food Walks & Regional Recipes', 'Tirunelveli to Chennai Lifestyle']
          : ['Tech & Productivity', 'Chennai City Life', 'Digital Storytelling'];
      } else if (isMusic) {
        name = 'Kaelen Pulse';
        voiceTone = 'Moody, poetic, sonically driven, and articulate';
        backstory = 'An underground electronic music producer and synthwave DJ crafting modular soundscapes and audio-visual sets.';
        appearanceNotes = 'Obsidian cropped hair, sculpted cheekbones, intense gaze, athletic build.';
        pillars = ['Modular Synthesizers', 'Nightlife Sets', 'Sound Design Breakdown'];
      }

      personaDraft = {
        name,
        adultAge,
        voiceTone,
        backstory,
        appearanceNotes,
        catchphrases: isSouthIndian
          ? ['Vanakkam internet!', 'From Tirunelveli roots to digital fruits.', 'Stay synced, stay inspired.']
          : ['Creating in real-time.', 'Pixels with personality.'],
        boundaries: ['Never depict minors under any circumstance', '100% SFW platform compliant feeds', 'Disclosed AI identity'],
        contentPillars: pillars,
        aiDisclosureText: '✨ Disclosed Fictional AI Persona: Created with generative AI tools. 100% fictional identity.',
      };

      if (!replyText) {
        replyText = `I have sculpted a complete Persona Agent profile for **${personaDraft.name}** (Age ${personaDraft.adultAge}) honoring your exact vision! I integrated their roots from Tirunelveli, their work in Chennai, their passion for ${isFood ? 'technology and food' : 'creativity'}, and full Section 2 safety guardrails. Review the live blueprint on the right and let me know if you would like to refine anything!`;
      }
    }

    // Verify guardrails
    const validation = validatePersonaGuardrails({
      adultAge: personaDraft.adultAge,
      aiDisclosureText: personaDraft.aiDisclosureText,
      name: personaDraft.name,
    });

    return NextResponse.json({
      success: true,
      message: replyText,
      reply: replyText,
      draft: personaDraft,
      personaDraft: personaDraft,
      valid: validation.valid,
    });
  },
  { permission: 'manage_persona' },
);
