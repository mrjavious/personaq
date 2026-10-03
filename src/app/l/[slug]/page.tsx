import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { PublicLandingClient } from './client';
import { recordPrivacyClickEvent, buildUtmUrl } from '@/lib/links/utm';

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
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = searchParams ? await searchParams : {};

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

  const isDirect =
    query.direct === '1' ||
    query.direct === 'true' ||
    !link.isNeutralLanding;

  if (isDirect) {
    const headerList = await headers();
    const getParam = (k: string) => {
      const v = query[k];
      return Array.isArray(v) ? v[0] : v;
    };

    const utmSource = getParam('utm_source');
    const utmCampaign = getParam('utm_campaign');
    const utmContent = getParam('utm_content');
    const utmMedium = getParam('utm_medium');
    const utmTerm = getParam('utm_term');

    // Record privacy-preserving click event
    try {
      await recordPrivacyClickEvent({
        linkId: link.id,
        utmSource: utmSource || null,
        utmCampaign: utmCampaign || null,
        utmContent: utmContent || null,
        referrer: headerList.get('referer') || null,
        headers: headerList,
      });
    } catch (e) {
      console.warn('Failed to record direct redirect click event:', e);
    }

    let destination = link.destinationUrl;
    if (utmSource) {
      try {
        destination = buildUtmUrl(destination, {
          utm_source: utmSource,
          utm_campaign: utmCampaign,
          utm_content: utmContent,
          utm_medium: utmMedium,
          utm_term: utmTerm,
        });
      } catch {
        // Fallback to destinationUrl
      }
    }

    redirect(destination);
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
        avatarUrl: link.persona.avatarUrl
          ? `/public-media/avatar/${link.persona.id}`
          : null,
        platforms: link.persona.platformAccounts,
      }}
    />
  );
}

