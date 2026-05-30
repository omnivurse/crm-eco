/**
 * Layer 2/3 enrollment DB harness — connectivity check + planned backlog.
 *
 * Run with: `npm run test:db --workspace=@crm-eco/lib`
 * Self-skips entirely unless a STAGING Supabase is configured (see testClient).
 */
import { describe, it, expect } from 'vitest';
import { getTestClient, hasTestDb } from './testClient';

describe.skipIf(!hasTestDb)('enrollment DB harness connectivity', () => {
  it('connects to the staging database and can read organizations', async () => {
    const db = getTestClient();
    const { error } = await db.from('organizations').select('id').limit(1);
    expect(error).toBeNull();
  });
});

/**
 * Layer 2/3 backlog — now IMPLEMENTED in sibling specs (2026-05-30):
 *   C1 idempotency           -> idempotency.db.spec.ts
 *   C2 member dedup (gap)     -> tenant-and-dedup.db.spec.ts
 *   C3 anon-surface lockdown  -> tenant-and-dedup.db.spec.ts
 *   C3 authenticated isolation-> cross-tenant.db.spec.ts (drove the org-scoping fix, 202605300012)
 *   trigger idempotency       -> trigger-idempotency.db.spec.ts
 * Still open: C2 dedup FIX (unique partial index + dedup-or-merge in create paths);
 * payment double-charge (H5) once the processor-abstraction layer (H3) exists.
 */
describe('enrollment DB/RLS backlog (remaining)', () => {
  it.todo('C2 FIX — a unique partial index on (lower(email), organization_id) rejects/merges duplicate members');
  it.todo('H5 — payment webhook double-charge detection (after the processor-abstraction layer lands)');
});
