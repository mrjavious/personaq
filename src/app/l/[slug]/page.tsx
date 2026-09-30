import React from 'react';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { PublicLandingClient } from './client';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const link = await prisma.linkHub.findUnique({
    where: { slug },
    include: { persona: true },
  });

  if (!link) {
    return { title: 'Persona Not Found - Persona Studio' };
  }

  return {
    title: `${link.persona.name} | Official Creative Hub`,
    description: `${link.persona.name} - ${link.persona.voiceTone}. Disclosed Fictional AI Persona.`,
  };
}

export default async function PublicLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const link = await prisma.linkHub.findUnique({
    where: { slug },
    include: {
      persona: {
        include: {
          platformAccounts: {
            where: { apiStatus: { not: 'inactive' } },
            select: { platform: true, handle: true },
          },
        },
      },
    },
  });

  if (!link) {
    notFound();
  }

  return (
    <PublicLandingClient
      linkId={link.id}
      slug={link.slug}
      destinationUrl={link.destinationUrl}
      persona={{
        name: link.persona.name,
        backstory: link.persona.backstory,
        voiceTone: link.persona.voiceTone,
        aiDisclosureText: link.persona.aiDisclosureText,
        avatarUrl: link.persona.avatarUrl,
        platforms: link.persona.platformAccounts,
      }}
    />
  );
}
