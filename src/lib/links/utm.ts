import { prisma } from '@/lib/db';

export interface UtmParams {
  utm_source: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}

export interface BuildUtmOptions {
  baseUrl: string;
  params: UtmParams;
}

/**
 * Builds a UTM-tagged URL, cleanly handling existing query parameters.
 */
export function buildUtmUrl(baseUrl: string, params: UtmParams): string {
  if (!baseUrl || !baseUrl.trim()) {
    throw new Error('Base URL cannot be empty');
  }

  // Handle relative vs absolute URLs
  const isRelative = baseUrl.startsWith('/');
  const dummyBase = 'https://personaq.local';
  const urlToParse = isRelative ? `${dummyBase}${baseUrl}` : baseUrl;

  let parsed: URL;
  try {
    parsed = new URL(urlToParse);
  } catch {
    throw new Error(`Invalid base URL: ${baseUrl}`);
  }

  if (params.utm_source) {
    parsed.searchParams.set('utm_source', params.utm_source.trim());
  }
  if (params.utm_medium) {
    parsed.searchParams.set('utm_medium', params.utm_medium.trim());
  }
  if (params.utm_campaign) {
    parsed.searchParams.set('utm_campaign', params.utm_campaign.trim());
  }
  if (params.utm_content) {
    parsed.searchParams.set('utm_content', params.utm_content.trim());
  }
  if (params.utm_term) {
    parsed.searchParams.set('utm_term', params.utm_term.trim());
  }

  if (isRelative) {
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  }
  return parsed.toString();
}

/**
 * Parses UTM parameters from a URL or query string.
 */
export function parseUtmParams(urlOrQuery: string): Partial<UtmParams> {
  const result: Partial<UtmParams> = {};
  if (!urlOrQuery) return result;

  try {
    const isRelative = urlOrQuery.startsWith('/') || urlOrQuery.startsWith('?');
    const dummyBase = 'https://personaq.local';
    const parsed = new URL(isRelative ? `${dummyBase}${urlOrQuery}` : urlOrQuery);

    const source = parsed.searchParams.get('utm_source');
    const medium = parsed.searchParams.get('utm_medium');
    const campaign = parsed.searchParams.get('utm_campaign');
    const content = parsed.searchParams.get('utm_content');
    const term = parsed.searchParams.get('utm_term');

    if (source) result.utm_source = source;
    if (medium) result.utm_medium = medium;
    if (campaign) result.utm_campaign = campaign;
    if (content) result.utm_content = content;
    if (term) result.utm_term = term;
  } catch {
    // If not a full URL, attempt simple regex or query string parsing
    const match = (key: string) => {
      const regex = new RegExp(`[?&]${key}=([^&#]*)`, 'i');
      const res = regex.exec(urlOrQuery);
      return res ? decodeURIComponent(res[1]) : undefined;
    };
    result.utm_source = match('utm_source');
    result.utm_medium = match('utm_medium');
    result.utm_campaign = match('utm_campaign');
    result.utm_content = match('utm_content');
    result.utm_term = match('utm_term');
  }

  return result;
}

/**
 * Privacy Check: Detects if client requested Do Not Track (DNT) or Global Privacy Control (GPC).
 */
export function shouldHonorPrivacy(
  headers: Headers | Record<string, string | string[] | undefined>
): boolean {
  if (headers instanceof Headers) {
    const dnt = headers.get('dnt');
    const gpc = headers.get('sec-gpc') || headers.get('x-do-not-track');
    return dnt === '1' || gpc === '1';
  }

  const dnt = headers['dnt'];
  const gpc = headers['sec-gpc'] || headers['x-do-not-track'];
  return (
    dnt === '1' ||
    (Array.isArray(dnt) && dnt[0] === '1') ||
    gpc === '1' ||
    (Array.isArray(gpc) && gpc[0] === '1')
  );
}

export interface RecordClickInput {
  linkId: string;
  utmSource?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  referrer?: string | null;
  headers?: Headers | Record<string, string | string[] | undefined>;
}

/**
 * Privacy-respecting click logger.
 * Guardrails / Spec Section 7:
 * - Minimal click data
 * - Zero fingerprinting (no IPs, no canvas, no cookie identifiers stored)
 * - Honors DNT/GPC by scrubbing referrer completely
 */
export async function recordPrivacyClickEvent(input: RecordClickInput) {
  const honorPrivacy = input.headers ? shouldHonorPrivacy(input.headers) : false;

  let sanitizedReferrer = input.referrer || null;
  if (honorPrivacy && sanitizedReferrer) {
    // If DNT is signaled, strip referrer to domain only or set null
    try {
      const refUrl = new URL(sanitizedReferrer);
      sanitizedReferrer = `${refUrl.protocol}//${refUrl.hostname}`;
    } catch {
      sanitizedReferrer = 'privacy_protected';
    }
  }

  return await prisma.clickEvent.create({
    data: {
      linkId: input.linkId,
      utmSource: input.utmSource?.slice(0, 100) || null,
      utmCampaign: input.utmCampaign?.slice(0, 100) || null,
      utmContent: input.utmContent?.slice(0, 100) || null,
      referrer: sanitizedReferrer?.slice(0, 255) || null,
    },
  });
}
