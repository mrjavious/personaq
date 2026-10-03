import prisma from '@/lib/db/prisma';
import {
  AUDIT_GENESIS_HASH,
  AuditCryptoMeta,
  buildCanonicalAuditPayload,
  computeAuditHash,
  verifyAuditSignature,
} from './logger';

export interface AuditLogFilter {
  action?: string;
  entity?: string;
  userId?: string;
  limit?: number;
  offset?: number;
}

export interface ChainVerificationResult {
  valid: boolean;
  totalRecordsChecked: number;
  chainedRecordsCount: number;
  genesisHash: string;
  latestHash?: string;
  corruptedRecordId?: string;
  failureReason?: string;
}

export async function getAuditLogs(filters: AuditLogFilter = {}) {
  const { action, entity, userId, limit = 50, offset = 0 } = filters;

  const where: Record<string, unknown> = {};
  if (action && action !== 'all') where.action = action;
  if (entity && entity !== 'all') where.entity = entity;
  if (userId) where.userId = userId;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { ts: 'desc' },
      take: limit,
      skip: offset,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs,
    total,
    limit,
    offset,
  };
}

/**
 * Traverses audit log records in chronological order and cryptographically
 * verifies every HMAC signature and sequential SHA-256 hash link.
 */
export async function verifyAuditLogChain(options: {
  maxRecords?: number;
  records?: Array<{
    id: string;
    userId: string | null;
    action: string;
    entity: string;
    entityId: string;
    meta: string | null;
    ts: Date;
  }>;
} = {}): Promise<ChainVerificationResult> {
  const { maxRecords = 1000 } = options;

  const records = options.records
    ? options.records
    : await prisma.auditLog.findMany({
        orderBy: { ts: 'asc' },
        take: maxRecords,
      });

  let lastHash: string | null = null;
  let lastSeq: number | null = null;
  let chainedRecordsCount = 0;

  for (const record of records) {
    if (!record.meta) continue;

    let parsedMeta: Record<string, unknown>;
    try {
      parsedMeta = JSON.parse(record.meta);
    } catch {
      continue;
    }

    const crypto = parsedMeta._crypto as AuditCryptoMeta | undefined;
    if (!crypto || !crypto.hash || !crypto.signature) {
      // Legacy unchained record before cryptographic logging was activated
      continue;
    }

    chainedRecordsCount++;

    // 1. Verify HMAC-SHA256 signature integrity
    const isSigValid = verifyAuditSignature(crypto.hash, crypto.signature);
    if (!isSigValid) {
      return {
        valid: false,
        totalRecordsChecked: records.length,
        chainedRecordsCount,
        genesisHash: AUDIT_GENESIS_HASH,
        corruptedRecordId: record.id,
        failureReason: `Invalid HMAC signature on record ${record.id} (action: ${record.action}, seq: ${crypto.seq})`,
      };
    }

    // 2. Recompute canonical hash to verify payload has not been tampered with
    const cleanMeta = { ...parsedMeta };
    delete cleanMeta._crypto;

    const canonicalPayload = buildCanonicalAuditPayload({
      seq: crypto.seq,
      prevHash: crypto.prevHash,
      action: record.action,
      entity: record.entity,
      entityId: record.entityId,
      userId: record.userId,
      ts: crypto.signedAt || record.ts.toISOString(),
      metaPayload: cleanMeta,
    });

    const expectedHash = computeAuditHash(canonicalPayload);
    if (crypto.hash !== expectedHash) {
      return {
        valid: false,
        totalRecordsChecked: records.length,
        chainedRecordsCount,
        genesisHash: AUDIT_GENESIS_HASH,
        corruptedRecordId: record.id,
        failureReason: `Hash mismatch on record ${record.id}. Expected ${expectedHash}, recorded ${crypto.hash}`,
      };
    }

    // 3. Verify sequence continuity and chain link to previous entry
    if (lastHash !== null && lastSeq !== null) {
      if (crypto.prevHash !== lastHash) {
        return {
          valid: false,
          totalRecordsChecked: records.length,
          chainedRecordsCount,
          genesisHash: AUDIT_GENESIS_HASH,
          corruptedRecordId: record.id,
          failureReason: `Chain break at record ${record.id} (seq: ${crypto.seq}). prevHash ${crypto.prevHash} does not match previous record hash ${lastHash}`,
        };
      }

      if (crypto.seq !== lastSeq + 1) {
        return {
          valid: false,
          totalRecordsChecked: records.length,
          chainedRecordsCount,
          genesisHash: AUDIT_GENESIS_HASH,
          corruptedRecordId: record.id,
          failureReason: `Sequence gap at record ${record.id}. Expected seq ${lastSeq + 1}, found ${crypto.seq}`,
        };
      }
    } else {
      // First chained record in verification batch
      if (crypto.seq === 1 && crypto.prevHash !== AUDIT_GENESIS_HASH) {
        return {
          valid: false,
          totalRecordsChecked: records.length,
          chainedRecordsCount,
          genesisHash: AUDIT_GENESIS_HASH,
          corruptedRecordId: record.id,
          failureReason: `Genesis record ${record.id} prevHash does not match AUDIT_GENESIS_HASH`,
        };
      }
    }

    lastHash = crypto.hash;
    lastSeq = crypto.seq;
  }

  return {
    valid: true,
    totalRecordsChecked: records.length,
    chainedRecordsCount,
    genesisHash: AUDIT_GENESIS_HASH,
    latestHash: lastHash || AUDIT_GENESIS_HASH,
  };
}

