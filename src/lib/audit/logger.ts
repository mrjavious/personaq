import { createHash, createHmac, timingSafeEqual } from 'crypto';
import prisma from '@/lib/db/prisma';

export const AUDIT_GENESIS_HASH = '0'.repeat(64);

export const AUDIT_SIGNING_KEY =
  process.env.AUDIT_SIGNING_KEY ||
  process.env.NEXTAUTH_SECRET ||
  'personaq-crypto-audit-chain-secret-key-2026';

export type AuditAction =
  | 'publish'
  | 'approve'
  | 'safety_decision'
  | 'override'
  | 'settings_change'
  | 'login'
  | '2fa_verify'
  | 'persona_update'
  | 'compliance_check'
  | 'reconcile_status'
  | 'dispatch_failure'
  | 'rules_updated'
  | 'rules_verified'
  | 'link_update'
  | 'export_data';

export type AuditEntity =
  | 'User'
  | 'Asset'
  | 'Post'
  | 'PostVariant'
  | 'Persona'
  | 'PlatformRule'
  | 'DraftReply'
  | 'LinkHub'
  | 'System'
  | 'ComplianceSnapshot';

export interface AuditCryptoMeta {
  seq: number;
  prevHash: string;
  hash: string;
  signature: string;
  alg: 'HMAC-SHA256';
  signedAt: string;
}

export interface AuditLogInput {
  userId?: string | null;
  action: AuditAction | string;
  entity: AuditEntity | string;
  entityId: string;
  meta?: Record<string, unknown> | null;
}

/**
 * Deterministically formats an object into a sorted JSON string for stable cryptographic hashing.
 */
export function deterministicStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(deterministicStringify).join(',') + ']';
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  return (
    '{' +
    keys
      .map(
        (k) =>
          JSON.stringify(k) +
          ':' +
          deterministicStringify((obj as Record<string, unknown>)[k])
      )
      .join(',') +
    '}'
  );
}

/**
 * Builds the canonical payload string for an audit log entry.
 */
export function buildCanonicalAuditPayload(entry: {
  seq: number;
  prevHash: string;
  action: string;
  entity: string;
  entityId: string;
  userId: string | null;
  ts: string;
  metaPayload: Record<string, unknown>;
}): string {
  // Ensure _crypto is excluded from payload to avoid circular dependency
  const cleanMeta = { ...entry.metaPayload };
  delete cleanMeta._crypto;

  return deterministicStringify({
    seq: entry.seq,
    prevHash: entry.prevHash,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    userId: entry.userId,
    ts: entry.ts,
    meta: cleanMeta,
  });
}

/**
 * Computes SHA-256 hash of canonical audit payload.
 */
export function computeAuditHash(canonicalPayload: string): string {
  return createHash('sha256').update(canonicalPayload, 'utf8').digest('hex');
}

/**
 * Computes HMAC-SHA256 signature over an audit hash.
 */
export function computeAuditSignature(
  hash: string,
  secret: string = AUDIT_SIGNING_KEY
): string {
  return createHmac('sha256', secret).update(hash, 'utf8').digest('hex');
}

/**
 * Safely verifies an HMAC signature against an audit hash using constant-time comparison.
 */
export function verifyAuditSignature(
  hash: string,
  signature: string,
  secret: string = AUDIT_SIGNING_KEY
): boolean {
  try {
    const expected = computeAuditSignature(hash, secret);
    const expectedBuf = Buffer.from(expected, 'hex');
    const signatureBuf = Buffer.from(signature, 'hex');
    if (expectedBuf.length !== signatureBuf.length) {
      return false;
    }
    return timingSafeEqual(expectedBuf, signatureBuf);
  } catch {
    return false;
  }
}

/**
 * Appends a tamper-evident audit log event cryptographically linked to the previous entry.
 */
export async function logAuditEvent(input: AuditLogInput) {
  try {
    let validUserId: string | null = null;
    if (input.userId) {
      const userExists = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true },
      });
      if (userExists) {
        validUserId = userExists.id;
      }
    }

    // Retrieve latest audit record to establish cryptographic chain link
    const latestRecord = await prisma.auditLog.findFirst({
      orderBy: { ts: 'desc' },
      select: { id: true, meta: true },
    });

    let prevHash = AUDIT_GENESIS_HASH;
    let seq = 1;

    if (latestRecord?.meta) {
      try {
        const parsed = JSON.parse(latestRecord.meta);
        if (parsed._crypto?.hash) {
          prevHash = parsed._crypto.hash;
          seq = (parsed._crypto.seq || 0) + 1;
        }
      } catch {
        // Fall back to genesis if prior metadata is unparseable
      }
    }

    const ts = new Date();
    const tsIso = ts.toISOString();

    const metaPayload: Record<string, unknown> = {
      ...(input.meta || {}),
      ...(!validUserId && input.userId ? { actorIdentifier: input.userId } : {}),
    };

    const canonicalPayload = buildCanonicalAuditPayload({
      seq,
      prevHash,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      userId: validUserId,
      ts: tsIso,
      metaPayload,
    });

    const hash = computeAuditHash(canonicalPayload);
    const signature = computeAuditSignature(hash);

    const cryptoMeta: AuditCryptoMeta = {
      seq,
      prevHash,
      hash,
      signature,
      alg: 'HMAC-SHA256',
      signedAt: tsIso,
    };

    const finalMeta = JSON.stringify({
      ...metaPayload,
      _crypto: cryptoMeta,
    });

    return await prisma.auditLog.create({
      data: {
        userId: validUserId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        meta: finalMeta,
        ts,
      },
    });
  } catch (error) {
    console.error('Failed to record tamper-evident audit log:', error);
    return null;
  }
}

