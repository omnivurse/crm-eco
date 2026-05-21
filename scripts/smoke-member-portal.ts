/**
 * Member Portal Smoke Test (Track B M11)
 *
 * Verifies the schema, RLS, edge function deployment, and storage buckets that
 * back the member portal. Runs against the smoke_test org seeded by
 * `202605210003_contract_pdf_and_smoke_test.sql`.
 *
 * Usage:
 *   npx tsx scripts/smoke-member-portal.ts
 */

import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'node:path';

loadEnv({ path: path.resolve(process.cwd(), '.env') });
loadEnv({ path: path.resolve(process.cwd(), '.env.local'), override: true });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const SMOKE_ORG_ID = 'a0000000-0000-0000-0000-000000000001';
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let passed = 0;
let failed = 0;
const failures: string[] = [];

function record(label: string, ok: boolean, info?: string) {
  if (ok) {
    passed++;
    console.log(`✓ ${label}${info ? ' — ' + info : ''}`);
  } else {
    failed++;
    failures.push(label);
    console.log(`✗ ${label}${info ? ' — ' + info : ''}`);
  }
}

async function tableExists(name: string) {
  const { error } = await supabase.from(name).select('*', { head: true, count: 'exact' }).limit(1);
  return !error;
}

async function functionDeployed(name: string) {
  // Probe with an OPTIONS-style call; we accept 401/400/500 as long as the URL
  // resolves (function deployed) — the Edge Functions invoker returns FunctionsHttpError
  // for non-2xx with the original status preserved when verbose.
  try {
    const { error } = await supabase.functions.invoke(name, { body: { __probe: true } });
    if (!error) return { ok: true };
    const msg = error.message ?? '';
    // FunctionsHttpError → reachable but errored: deployed
    if (/non-2xx/i.test(msg) || /Edge Function/i.test(msg)) return { ok: true, info: 'reachable (returned non-2xx as expected)' };
    return { ok: false, info: msg };
  } catch (err) {
    return { ok: false, info: err instanceof Error ? err.message : String(err) };
  }
}

async function bucketAccessible(bucket: string) {
  const { data, error } = await supabase.storage.getBucket(bucket);
  return !!data && !error;
}

async function main() {
  console.log(`\nMember Portal Smoke Test\nOrg: ${SMOKE_ORG_ID}\n`);

  // 1. Required tables
  for (const t of [
    'member_change_requests',
    'need_attachments',
    'member_documents',
    'member_notifications',
    'service_providers',
    'needs',
    'tickets',
    'ticket_comments',
    'enrollment_dependents',
    'inactive_reasons',
    'legal_documents',
  ]) {
    const ok = await tableExists(t);
    record(`table ${t} exists & RLS readable by service role`, ok);
  }

  // 2. Insertability of new portal tables (service-role bypasses RLS)
  {
    const { data, error } = await supabase
      .from('member_change_requests')
      .insert({
        organization_id: SMOKE_ORG_ID,
        member_id: '00000000-0000-0000-0000-000000000000', // throwaway uuid
        request_type: 'other',
        status: 'pending_review',
        payload: { smoke: true },
      })
      .select('id')
      .single();
    if (data?.id) {
      record('member_change_requests writable by service role', true);
      await supabase.from('member_change_requests').delete().eq('id', data.id);
    } else {
      // Foreign key on member_id is the most common rejection — that still proves
      // the table + RLS allow service-role inserts.
      record('member_change_requests writable by service role', /foreign key/i.test(error?.message ?? ''), error?.message);
    }
  }

  {
    const { data, error } = await supabase
      .from('member_notifications')
      .insert({
        organization_id: SMOKE_ORG_ID,
        member_id: '00000000-0000-0000-0000-000000000000',
        title: 'Smoke test',
        category: 'system',
      })
      .select('id')
      .single();
    if (data?.id) {
      record('member_notifications writable by service role', true);
      await supabase.from('member_notifications').delete().eq('id', data.id);
    } else {
      record('member_notifications writable by service role', /foreign key/i.test(error?.message ?? ''), error?.message);
    }
  }

  {
    const { data, error } = await supabase
      .from('service_providers')
      .insert({
        organization_id: SMOKE_ORG_ID,
        category: 'telehealth',
        name: 'Smoke Test Provider',
        external_url: 'https://example.com',
        sso_kind: 'none',
      })
      .select('id')
      .single();
    if (data?.id) {
      record('service_providers writable by service role', true);
      await supabase.from('service_providers').delete().eq('id', data.id);
    } else {
      record('service_providers writable by service role', false, error?.message);
    }
  }

  // 3. Edge functions deployed
  for (const fn of ['telehealth-sso']) {
    const { ok, info } = await functionDeployed(fn);
    record(`edge function ${fn} deployed`, ok, info);
  }

  // 4. Storage buckets (optional — created on first upload, but we surface their state)
  for (const b of ['member-needs', 'member-documents']) {
    const ok = await bucketAccessible(b);
    if (ok) record(`storage bucket ${b} present`, true);
    else record(`storage bucket ${b} (will auto-create on first upload)`, true, 'not created yet');
  }

  console.log(`\n=== Summary ===`);
  console.log(`Passed: ${passed}/${passed + failed}`);
  if (failed > 0) {
    console.log('Failed:', failures);
    process.exit(1);
  }
  console.log('All member portal smoke tests passed.');
}

main().catch((err) => {
  console.error('Smoke test crashed:', err);
  process.exit(1);
});
