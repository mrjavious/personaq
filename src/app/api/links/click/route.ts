import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { recordPrivacyClickEvent, buildUtmUrl, parseUtmParams } from '@/lib/links/utm';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { linkId, slug, utmSource, utmCampaign, utmContent, referrer } = body;

    let targetLinkId = linkId;
    if (!targetLinkId && slug) {
      const found = await prisma.linkHub.findUnique({ where: { slug } });
      if (found) {
        targetLinkId = found.id;
      }
    }

    if (!targetLinkId) {
      return NextResponse.json({ error: 'Valid linkId or slug is required' }, { status: 400 });
    }

    const clickEvent = await recordPrivacyClickEvent({
      linkId: targetLinkId,
      utmSource: utmSource || null,
      utmCampaign: utmCampaign || null,
      utmContent: utmContent || null,
      referrer: referrer || req.headers.get('referer') || null,
      headers: req.headers,
    });

    return NextResponse.json({ ok: true, clickId: clickEvent.id });
  } catch (error) {
    console.error('Error recording click event:', error);
    return NextResponse.json({ error: 'Failed to record click' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    const linkId = searchParams.get('linkId');

    let link = null;
    if (slug) {
      link = await prisma.linkHub.findUnique({ where: { slug } });
    } else if (linkId) {
      link = await prisma.linkHub.findUnique({ where: { id: linkId } });
    }

    if (!link) {
      return NextResponse.redirect(new URL('/', req.url));
    }

    // Capture UTM parameters from incoming query string
    const parsed = parseUtmParams(req.url);

    // Record the click event
    await recordPrivacyClickEvent({
      linkId: link.id,
      utmSource: parsed.utm_source || null,
      utmCampaign: parsed.utm_campaign || null,
      utmContent: parsed.utm_content || null,
      referrer: req.headers.get('referer') || null,
      headers: req.headers,
    });

    // Append UTM tags to the destination URL if present
    let destination = link.destinationUrl;
    if (parsed.utm_source) {
      try {
        destination = buildUtmUrl(destination, {
          utm_source: parsed.utm_source,
          utm_medium: parsed.utm_medium,
          utm_campaign: parsed.utm_campaign,
          utm_content: parsed.utm_content,
          utm_term: parsed.utm_term,
        });
      } catch (e) {
        console.warn('Could not append UTM to destination URL:', e);
      }
    }

    return NextResponse.redirect(destination, { status: 307 });
  } catch (error) {
    console.error('Error handling click redirect:', error);
    return NextResponse.redirect(new URL('/', req.url));
  }
}
