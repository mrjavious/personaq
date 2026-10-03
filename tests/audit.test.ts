import { describe, it, expect } from 'vitest';
import {
  logAuditEvent,
  computeAuditHash,
  computeAuditSignature,
  verifyAuditSignature,
  deterministicStringify,
  buildCanonicalAuditPayload,
  AUDIT_GENESIS_HASH,
} from '@/lib/audit/logger';
import { verifyAuditLogChain } from '@/lib/audit/service';

describe('Tamper-Evident Cryptographic Audit Log & HMAC Chaining', () => {
  describe('Deterministic Hashing & HMAC Helpers', () => {
    it('produces identical stringified output regardless of key order', () => {
      const objA = { z: 1, a: 2, m: { nestedB: true, nestedA: 'hello' } };
      const objB = { a: 2, m: { nestedA: 'hello', nestedB: true }, z: 1 };

      expect(deterministicStringify(objA)).toBe(deterministicStringify(objB));
    });

    it('computes and verifies constant-time HMAC-SHA256 signature', () => {
      const payload = 'canonical-audit-payload-v1';
      const hash = computeAuditHash(payload);
      const signature = computeAuditSignature(hash);

      expect(hash).toHaveLength(64);
      expect(signature).toHaveLength(64);
      expect(verifyAuditSignature(hash, signature)).toBe(true);
      expect(verifyAuditSignature(hash, 'invalid-signature-hex-1234567890abcdef')).toBe(false);
    });
  });

  describe('Audit Event Chaining & Cryptographic Verification', () => {
    it('creates audit records with valid _crypto metadata structure in DB', async () => {
      const log = await logAuditEvent({
        action: 'settings_change',
        entity: 'System',
        entityId: 'audit-test-sys',
        meta: { test: 'live_logging_test' },
      });

      expect(log).toBeDefined();
      expect(log?.meta).toBeDefined();
      const meta = JSON.parse(log!.meta!);
      expect(meta._crypto).toBeDefined();
      expect(meta._crypto.alg).toBe('HMAC-SHA256');
      expect(typeof meta._crypto.seq).toBe('number');
      expect(meta._crypto.hash).toHaveLength(64);
      expect(meta._crypto.signature).toHaveLength(64);
      expect(meta._crypto.signedAt).toBeDefined();
      expect(verifyAuditSignature(meta._crypto.hash, meta._crypto.signature)).toBe(true);
    });

    it('cryptographically validates a chained sequence of audit records', async () => {
      const tsA = new Date().toISOString();
      const payloadA = buildCanonicalAuditPayload({
        seq: 1,
        prevHash: AUDIT_GENESIS_HASH,
        action: 'publish',
        entity: 'Post',
        entityId: 'post-101',
        userId: 'user-1',
        ts: tsA,
        metaPayload: { concept: 'test-concept' },
      });
      const hashA = computeAuditHash(payloadA);
      const sigA = computeAuditSignature(hashA);

      const recordA = {
        id: 'rec-001',
        userId: 'user-1',
        action: 'publish',
        entity: 'Post',
        entityId: 'post-101',
        meta: JSON.stringify({
          concept: 'test-concept',
          _crypto: {
            seq: 1,
            prevHash: AUDIT_GENESIS_HASH,
            hash: hashA,
            signature: sigA,
            alg: 'HMAC-SHA256' as const,
            signedAt: tsA,
          },
        }),
        ts: new Date(tsA),
      };

      const tsB = new Date().toISOString();
      const payloadB = buildCanonicalAuditPayload({
        seq: 2,
        prevHash: hashA,
        action: 'safety_decision',
        entity: 'Asset',
        entityId: 'asset-202',
        userId: null,
        ts: tsB,
        metaPayload: { score: 99 },
      });
      const hashB = computeAuditHash(payloadB);
      const sigB = computeAuditSignature(hashB);

      const recordB = {
        id: 'rec-002',
        userId: null,
        action: 'safety_decision',
        entity: 'Asset',
        entityId: 'asset-202',
        meta: JSON.stringify({
          score: 99,
          _crypto: {
            seq: 2,
            prevHash: hashA,
            hash: hashB,
            signature: sigB,
            alg: 'HMAC-SHA256' as const,
            signedAt: tsB,
          },
        }),
        ts: new Date(tsB),
      };

      const result = await verifyAuditLogChain({ records: [recordA, recordB] });
      expect(result.valid).toBe(true);
      expect(result.chainedRecordsCount).toBe(2);
      expect(result.latestHash).toBe(hashB);
    });

    it('detects tampering when an audit payload is modified after signing', async () => {
      const tsA = new Date().toISOString();
      const payloadA = buildCanonicalAuditPayload({
        seq: 1,
        prevHash: AUDIT_GENESIS_HASH,
        action: 'override',
        entity: 'Asset',
        entityId: 'asset-303',
        userId: 'admin-1',
        ts: tsA,
        metaPayload: { reason: 'legitimate reason' },
      });
      const hashA = computeAuditHash(payloadA);
      const sigA = computeAuditSignature(hashA);

      // Simulating database tampering: meta payload was altered from "legitimate reason" to "fraudulent override"
      const tamperedRecord = {
        id: 'rec-tampered-1',
        userId: 'admin-1',
        action: 'override',
        entity: 'Asset',
        entityId: 'asset-303',
        meta: JSON.stringify({
          reason: 'fraudulent override', // Tampered!
          _crypto: {
            seq: 1,
            prevHash: AUDIT_GENESIS_HASH,
            hash: hashA,
            signature: sigA,
            alg: 'HMAC-SHA256' as const,
            signedAt: tsA,
          },
        }),
        ts: new Date(tsA),
      };

      const result = await verifyAuditLogChain({ records: [tamperedRecord] });
      expect(result.valid).toBe(false);
      expect(result.corruptedRecordId).toBe('rec-tampered-1');
      expect(result.failureReason).toContain('Hash mismatch');
    });

    it('detects tampering when an HMAC signature is forged or corrupted', async () => {
      const tsA = new Date().toISOString();
      const payloadA = buildCanonicalAuditPayload({
        seq: 1,
        prevHash: AUDIT_GENESIS_HASH,
        action: 'settings_change',
        entity: 'PlatformRule',
        entityId: 'rule-404',
        userId: 'admin-1',
        ts: tsA,
        metaPayload: { platform: 'instagram' },
      });
      const hashA = computeAuditHash(payloadA);

      const forgedRecord = {
        id: 'rec-forged-sig',
        userId: 'admin-1',
        action: 'settings_change',
        entity: 'PlatformRule',
        entityId: 'rule-404',
        meta: JSON.stringify({
          platform: 'instagram',
          _crypto: {
            seq: 1,
            prevHash: AUDIT_GENESIS_HASH,
            hash: hashA,
            signature: 'f'.repeat(64), // Invalid forged signature!
            alg: 'HMAC-SHA256' as const,
            signedAt: tsA,
          },
        }),
        ts: new Date(tsA),
      };

      const result = await verifyAuditLogChain({ records: [forgedRecord] });
      expect(result.valid).toBe(false);
      expect(result.corruptedRecordId).toBe('rec-forged-sig');
      expect(result.failureReason).toContain('Invalid HMAC signature');
    });

    it('detects a broken chain link when prevHash does not match prior hash', async () => {
      const tsA = new Date().toISOString();
      const payloadA = buildCanonicalAuditPayload({
        seq: 1,
        prevHash: AUDIT_GENESIS_HASH,
        action: 'publish',
        entity: 'Post',
        entityId: 'p-1',
        userId: null,
        ts: tsA,
        metaPayload: {},
      });
      const hashA = computeAuditHash(payloadA);
      const sigA = computeAuditSignature(hashA);

      const recordA = {
        id: 'rec-a',
        userId: null,
        action: 'publish',
        entity: 'Post',
        entityId: 'p-1',
        meta: JSON.stringify({
          _crypto: {
            seq: 1,
            prevHash: AUDIT_GENESIS_HASH,
            hash: hashA,
            signature: sigA,
            alg: 'HMAC-SHA256' as const,
            signedAt: tsA,
          },
        }),
        ts: new Date(tsA),
      };

      const tsB = new Date().toISOString();
      // Broken: points to a random non-existent hash instead of hashA
      const bogusPrevHash = 'e'.repeat(64);
      const payloadB = buildCanonicalAuditPayload({
        seq: 2,
        prevHash: bogusPrevHash,
        action: 'publish',
        entity: 'Post',
        entityId: 'p-2',
        userId: null,
        ts: tsB,
        metaPayload: {},
      });
      const hashB = computeAuditHash(payloadB);
      const sigB = computeAuditSignature(hashB);

      const recordB = {
        id: 'rec-b',
        userId: null,
        action: 'publish',
        entity: 'Post',
        entityId: 'p-2',
        meta: JSON.stringify({
          _crypto: {
            seq: 2,
            prevHash: bogusPrevHash,
            hash: hashB,
            signature: sigB,
            alg: 'HMAC-SHA256' as const,
            signedAt: tsB,
          },
        }),
        ts: new Date(tsB),
      };

      const result = await verifyAuditLogChain({ records: [recordA, recordB] });
      expect(result.valid).toBe(false);
      expect(result.corruptedRecordId).toBe('rec-b');
      expect(result.failureReason).toContain('Chain break');
    });
  });
});
