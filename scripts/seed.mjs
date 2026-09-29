import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Persona Studio database...');

  // 1. Seed Owner User
  const ownerEmail = 'creator@personaq.local';
  const existingUser = await prisma.user.findUnique({ where: { email: ownerEmail } });

  let user = existingUser;
  if (!existingUser) {
    const passwordHash = await bcrypt.hash('password123', 10);
    user = await prisma.user.create({
      data: {
        email: ownerEmail,
        passwordHash,
        role: 'owner',
        totpEnabled: false, // User can enable in 2FA settings or via onboarding
      },
    });
    console.log(`✓ Created owner user: ${ownerEmail} (password: password123)`);
  } else {
    console.log(`ℹ Owner user already exists: ${ownerEmail}`);
  }

  // 2. Seed Default Persona (Compliant with Section 2 Guardrails)
  const existingPersona = await prisma.persona.findFirst();
  let persona = existingPersona;

  if (!existingPersona) {
    persona = await prisma.persona.create({
      data: {
        name: 'Aria Nova',
        adultAge: 26, // Strictly >= 25 recommended adult age
        backstory:
          'Aria Nova is a fictional digital artist and creative technologist based in Neo-Arcadia. She shares workflow breakdowns, neon-lit aesthetics, and speculative fiction exploring human creativity in an AI-assisted era.',
        appearanceNotes:
          'Fictional stylized character with lavender-tinted silver hair, violet eyes, modern sleek techwear. Distinctly digital-rendered aesthetic. Zero reference or resemblance to any real living or deceased person.',
        voiceTone: 'Thoughtful, curious, witty, approachable, and transparently digital.',
        catchphrases: JSON.stringify([
          'Where imagination compiles into pixels.',
          'Digital dreams, authentic curiosity.',
          'Crafting new frontiers together.',
        ]),
        boundaries: JSON.stringify([
          'Never depict minors or youthful personas under any circumstance.',
          'Never simulate real personal trauma or grief.',
          'Never represent identity as a real living human.',
          'Keep social feeds 100% platform-compliant and SFW.',
        ]),
        contentPillars: JSON.stringify([
          'Digital Art & Aesthetic Worldbuilding',
          'Creative AI Experiments & Tutorials',
          'Behind the Scenes & Workflow Tips',
          'Community Q&A & Creative Prompts',
        ]),
        aiDisclosureText:
          '✨ Disclosed Fictional AI Persona: Created with generative AI tools. 100% fictional identity.',
      },
    });
    console.log(`✓ Created default compliant persona: ${persona.name} (Age: ${persona.adultAge})`);
  } else {
    console.log(`ℹ Persona already exists: ${existingPersona.name}`);
  }

  // 3. Seed Platform Accounts for Persona
  const platforms = [
    { platform: 'instagram', handle: '@aria.nova.ai', apiStatus: 'active', disclosureInBio: true },
    { platform: 'x', handle: '@arianova_ai', apiStatus: 'active', disclosureInBio: true },
    { platform: 'threads', handle: '@aria.nova.ai', apiStatus: 'active', disclosureInBio: true },
    { platform: 'tiktok', handle: '@arianova_digital', apiStatus: 'manual_assist', disclosureInBio: true },
    { platform: 'fanvue', handle: 'arianova', apiStatus: 'manual_assist', disclosureInBio: true },
  ];

  for (const pa of platforms) {
    const existing = await prisma.platformAccount.findFirst({
      where: { personaId: persona.id, platform: pa.platform, handle: pa.handle },
    });
    if (!existing) {
      await prisma.platformAccount.create({
        data: {
          personaId: persona.id,
          platform: pa.platform,
          handle: pa.handle,
          apiStatus: pa.apiStatus,
          disclosureInBio: pa.disclosureInBio,
          lastVerifiedAt: new Date(),
        },
      });
      console.log(`✓ Linked platform account: ${pa.platform} (${pa.handle})`);
    }
  }

  // 4. Seed Platform Rules (Section 2 Guardrail 9: Platform rules are data, not code)
  const defaultRules = [
    {
      platform: 'instagram',
      rulesJson: JSON.stringify({
        allowed_suitability: ['sfw_safe'],
        max_caption_length: 2200,
        max_hashtags: 30,
        recommended_aspect_ratios: ['1:1', '4:5', '9:16'],
        ai_label_mandatory: true,
        ai_label_instructions: 'Toggle "AI label" in Advanced Settings before publishing.',
        link_policy: 'Links only allowed in bio or Instagram Stories stickers.',
      }),
    },
    {
      platform: 'x',
      rulesJson: JSON.stringify({
        allowed_suitability: ['sfw_safe'],
        max_caption_length: 280,
        max_hashtags: 4,
        recommended_aspect_ratios: ['16:9', '1:1'],
        ai_label_mandatory: true,
        ai_label_instructions: 'Include #AI or clear disclosure text in post or bio.',
        link_policy: 'Links allowed inline with UTM tracking tags.',
      }),
    },
    {
      platform: 'threads',
      rulesJson: JSON.stringify({
        allowed_suitability: ['sfw_safe'],
        max_caption_length: 500,
        max_hashtags: 5,
        recommended_aspect_ratios: ['1:1', '4:5'],
        ai_label_mandatory: true,
        ai_label_instructions: 'Enable AI label flag and state persona disclosure in profile.',
        link_policy: 'Links allowed in post body with automatic preview card.',
      }),
    },
    {
      platform: 'tiktok',
      rulesJson: JSON.stringify({
        allowed_suitability: ['sfw_safe'],
        max_caption_length: 2200,
        max_hashtags: 6,
        recommended_aspect_ratios: ['9:16'],
        ai_label_mandatory: true,
        ai_label_instructions: 'Switch on "AI-generated content" toggle on upload screen.',
        link_policy: 'Bio link available for Creator / Business accounts.',
      }),
    },
    {
      platform: 'fanvue',
      rulesJson: JSON.stringify({
        allowed_suitability: ['sfw_safe', 'adult_only'],
        max_caption_length: 5000,
        max_hashtags: 10,
        recommended_aspect_ratios: ['1:1', '4:5', '9:16'],
        ai_label_mandatory: true,
        ai_label_instructions: 'Select AI Creator account category upon profile creation.',
        link_policy: 'Destination monetization platform.',
      }),
    },
  ];

  for (const rule of defaultRules) {
    await prisma.platformRule.upsert({
      where: { platform: rule.platform },
      update: {
        rulesJson: rule.rulesJson,
        lastVerifiedAt: new Date(),
      },
      create: {
        platform: rule.platform,
        rulesJson: rule.rulesJson,
        lastVerifiedAt: new Date(),
      },
    });
    console.log(`✓ Configured platform rule for: ${rule.platform}`);
  }

  // 5. Seed initial link hub
  const existingHub = await prisma.linkHub.findFirst({ where: { slug: 'aria' } });
  if (!existingHub) {
    await prisma.linkHub.create({
      data: {
        personaId: persona.id,
        slug: 'aria',
        destinationUrl: 'https://fanvue.com/arianova',
        isNeutralLanding: true,
      },
    });
    console.log('✓ Created neutral Link Hub: /l/aria');
  }

  // 6. Record Audit Log for initialization
  await prisma.auditLog.create({
    data: {
      userId: user?.id,
      action: 'settings_change',
      entity: 'System',
      entityId: 'init',
      meta: JSON.stringify({
        event: 'Initial Phase 0 database seeded',
        persona: persona.name,
        rulesConfigured: defaultRules.map((r) => r.platform),
      }),
    },
  });
  console.log('✓ Recorded system initialization in AuditLog');

  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
