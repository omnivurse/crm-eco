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
 * Decision-INDEPENDENT Layer 2/3 cases to implement once staging is wired.
 * (Payment double-charge + anonymous public-link RLS cases are deferred until
 * the payment-processor and anon-self-enroll decisions land.)
 */
describe('enrollment DB/RLS backlog (planned)', () => {
  it.todo('C1 — create_enrollment_tx: a repeated idempotency key creates no duplicate enrollment');
  it.todo('C2 — member dedup: same (email, organization_id) does not create a duplicate member');
  it.todo('C3 — cross-tenant isolation: a user in org A cannot read or write org B enrollments');
  it.todo('triggers — re-running activation does not double-insert billing_schedules / commissions');
});
