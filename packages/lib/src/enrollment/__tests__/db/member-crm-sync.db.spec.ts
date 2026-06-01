/**
 * Layer 2 — members → crm_records sync for family-shared emails (bug B1).
 *
 * Runs ONLY against a STAGING Supabase (self-skips otherwise). CREATES + MUTATES rows —
 * NEVER point SUPABASE_TEST_URL at production.
 *
 * THIS IS A FIX-LOCKING SPEC for the DRAFT migration
 *   supabase/drafts/202605300016_fix_member_sync_family_email.sql
 * It is EXPECTED TO BE RED until that migration is applied to staging:
 *
 *   `members` allows two ACTIVE members per (org, email) with different names (a spouse
 *   and dependent legitimately share one email). But crm_records is uniquely keyed on
 *   (org_id, module_id, lower(email)) (idx_crm_records_unique_email), so the members-module
 *   sync INSERTs `ON CONFLICT ... DO NOTHING` and the SECOND family member never gets a
 *   crm_record — they are permanently invisible in the members CRM module. The fix keys the
 *   members module by system->>'source_id' (one record per member, not per email).
 *
 * After 202605300016 lands on staging, this suite turns GREEN and guards against regression.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestClient, hasTestDb } from './testClient';

const uniq = () => `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

describe.skipIf(!hasTestDb)('enrollment Layer 2 — member→crm sync, family-shared email (staging)', () => {
  const db = hasTestDb ? getTestClient() : (null as never);
  let orgId = '';
  let membersModuleId = '';

  beforeAll(async () => {
    const slug = `b1-${uniq()}`;
    const { data: org, error: oErr } = await db
      .from('organizations')
      .insert({ name: `B1 ${slug}`, slug })
      .select('id')
      .single();
    if (oErr) throw new Error(`org: ${oErr.message}`);
    orgId = org.id as string;

    // Ensure a 'members' CRM module exists for this org so sync_member_to_crm_records
    // actually fires (the trigger early-returns when the module is absent). Some orgs
    // auto-seed modules, so select-or-insert to stay robust either way.
    const { data: existing } = await db
      .from('crm_modules')
      .select('id')
      .eq('org_id', orgId)
      .eq('key', 'members')
      .maybeSingle();
    if (existing?.id) {
      membersModuleId = existing.id as string;
    } else {
      const { data: mod, error: modErr } = await db
        .from('crm_modules')
        .insert({
          org_id: orgId,
          key: 'members',
          name: 'Member',
          name_plural: 'Members',
          is_enabled: true,
          is_system: true,
        })
        .select('id')
        .single();
      if (modErr) throw new Error(`crm_modules: ${modErr.message}`);
      membersModuleId = mod.id as string;
    }
  });

  afterAll(async () => {
    // ON DELETE CASCADE on members/crm_modules.organization_id cleans up seeded rows.
    if (orgId) await db.from('organizations').delete().eq('id', orgId);
  });

  function insertMember(email: string, firstName: string, lastName: string) {
    return db
      .from('members')
      .insert({
        organization_id: orgId,
        first_name: firstName,
        last_name: lastName,
        email,
        member_number: `MBR-${uniq()}`,
      })
      .select('id')
      .single();
  }

  /** All members-module crm_records this org has, keyed by their source member id. */
  async function membersModuleRecordsBySource(): Promise<Map<string, string>> {
    const { data, error } = await db
      .from('crm_records')
      .select('id, system')
      .eq('module_id', membersModuleId);
    expect(error).toBeNull();
    const bySource = new Map<string, string>();
    for (const r of (data ?? []) as Array<{ id: string; system: { source_table?: string; source_id?: string } | null }>) {
      if (r.system?.source_table === 'members' && r.system?.source_id) {
        bySource.set(r.system.source_id, r.id);
      }
    }
    return bySource;
  }

  it('B1 — two same-email, different-name members each get their OWN members-module crm_record', async () => {
    const sharedEmail = `family_${uniq()}@example.test`;

    const a = await insertMember(sharedEmail, 'John', 'Smith');
    const b = await insertMember(sharedEmail, 'Jane', 'Smith');
    expect(a.error).toBeNull();
    expect(b.error).toBeNull(); // both members exist (different names → allowed)
    const aId = (a.data as { id: string }).id;
    const bId = (b.data as { id: string }).id;

    const records = await membersModuleRecordsBySource();

    // The core guarantee: ONE members-module record per member, including the 2nd family
    // member. RED until 202605300016 keys the members module by source_id instead of email.
    expect(records.has(aId)).toBe(true);
    expect(records.has(bId)).toBe(true); // <-- the bug: today this is `false` (B dropped)
    expect(records.get(aId)).not.toBe(records.get(bId)); // distinct records, not a shared row
  });

  it('B1 — editing the 2nd family member keeps (not loses) their members-module record', async () => {
    const sharedEmail = `family2_${uniq()}@example.test`;
    const a = await insertMember(sharedEmail, 'Alice', 'Jones');
    const b = await insertMember(sharedEmail, 'Bob', 'Jones');
    expect(a.error).toBeNull();
    expect(b.error).toBeNull();
    const bId = (b.data as { id: string }).id;

    // Touch the second member (the UPDATE path's "update-then-insert-if-missing" fallback
    // must not keep losing the conflict).
    const { error: upErr } = await db.from('members').update({ phone: '555-0100' }).eq('id', bId);
    expect(upErr).toBeNull();

    const records = await membersModuleRecordsBySource();
    expect(records.has(bId)).toBe(true); // RED until the fix; otherwise still invisible
  });
});
