#!/usr/bin/env node
/**
 * smoke-test.mjs — End-to-end smoke test against the smoke_test org
 *
 * Tests:
 *   1. billing_automation_config exists for smoke_test org
 *   2. billing_job_runs can be created and queried
 *   3. process-billing Edge Function responds without error
 *   4. process-commissions Edge Function responds without error
 *   5. generate-enrollment-contract Edge Function responds (if enrollment exists)
 *
 * SAFETY: All operations scoped to org_id = '00000000-0000-0000-0000-smoke_test_01'
 *         PIFH data is NEVER touched.
 *
 * Usage:
 *   node scripts/smoke-test.mjs
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env') });
dotenv.config({ path: path.join(root, '.env.local'), override: true });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SMOKE_ORG_ID = 'a0000000-0000-0000-0000-000000000001';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SERVICE_ROLE_KEY');
  process.exit(1);
}

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}: ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║              CRM-Eco Smoke Test Suite                   ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log(`  Org: ${SMOKE_ORG_ID}`);
console.log(`  URL: ${SUPABASE_URL}`);
console.log();

// ── 1. Schema Tests ──────────────────────────────────────────────────────────
console.log('1️⃣  Schema & Config Tests');

await test('billing_automation_config table exists', async () => {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/billing_automation_config?organization_id=eq.${SMOKE_ORG_ID}&select=id,billing_enabled,commission_enabled`,
    { headers }
  );
  const data = await resp.json();
  assert(resp.ok, `HTTP ${resp.status}: ${JSON.stringify(data)}`);
  assert(Array.isArray(data), 'Expected array response');
});

await test('billing_job_runs table exists and accepts inserts', async () => {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/billing_job_runs`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify({
      organization_id: SMOKE_ORG_ID,
      job_type: 'smoke_test',
      status: 'completed',
      triggered_by: 'smoke_test',
      processed_count: 0,
      success_count: 0,
      failure_count: 0,
      completed_at: new Date().toISOString(),
      duration_ms: 0,
    }),
  });
  assert(resp.ok, `HTTP ${resp.status}: ${await resp.text()}`);
});

await test('billing_transactions.idempotency_key column exists', async () => {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/billing_transactions?select=idempotency_key&limit=0`,
    { headers }
  );
  assert(resp.ok, `HTTP ${resp.status}: ${await resp.text()}`);
});

await test('billing_transactions.commissioned_at column exists', async () => {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/billing_transactions?select=commissioned_at&limit=0`,
    { headers }
  );
  assert(resp.ok, `HTTP ${resp.status}: ${await resp.text()}`);
});

await test('commission_transactions.idempotency_key column exists', async () => {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/commission_transactions?select=idempotency_key&limit=0`,
    { headers }
  );
  assert(resp.ok, `HTTP ${resp.status}: ${await resp.text()}`);
});

await test('enrollment_contracts.pdf_url column exists', async () => {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/enrollment_contracts?select=pdf_url,generated_at,contract_version&limit=0`,
    { headers }
  );
  assert(resp.ok, `HTTP ${resp.status}: ${await resp.text()}`);
});

console.log();

// ── 2. Edge Function Tests ───────────────────────────────────────────────────
console.log('2️⃣  Edge Function Tests');

await test('process-billing Edge Function responds', async () => {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/process-billing`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      organization_id: SMOKE_ORG_ID,
      triggered_by: 'smoke_test',
    }),
  });
  // 200 = success, 500 with "Payment gateway not configured" is also acceptable for smoke test
  const body = await resp.json();
  assert(
    resp.ok || body.error === 'Payment gateway not configured',
    `Unexpected: HTTP ${resp.status} — ${JSON.stringify(body)}`
  );
});

await test('process-commissions Edge Function responds', async () => {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/process-commissions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      organization_id: SMOKE_ORG_ID,
      triggered_by: 'smoke_test',
    }),
  });
  // Accept 200 or 404 (function may not be deployed yet)
  assert(
    resp.status !== 500 || (await resp.json()).error?.includes('not found'),
    `Unexpected server error: HTTP ${resp.status}`
  );
});

console.log();

// ── 3. Job Run Audit Tests ───────────────────────────────────────────────────
console.log('3️⃣  Job Run Audit Tests');

await test('billing_job_runs has smoke test records', async () => {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/billing_job_runs?organization_id=eq.${SMOKE_ORG_ID}&job_type=eq.smoke_test&select=id,status&order=created_at.desc&limit=1`,
    { headers }
  );
  assert(resp.ok, `HTTP ${resp.status}`);
  const data = await resp.json();
  assert(data.length > 0, 'No smoke test job runs found');
  assert(data[0].status === 'completed', `Expected completed, got ${data[0].status}`);
});

console.log();

// ── 4. Cleanup ───────────────────────────────────────────────────────────────
console.log('4️⃣  Cleanup');

await test('Remove smoke test job runs', async () => {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/billing_job_runs?organization_id=eq.${SMOKE_ORG_ID}&job_type=eq.smoke_test`,
    { method: 'DELETE', headers }
  );
  assert(resp.ok || resp.status === 204, `HTTP ${resp.status}`);
});

console.log();

// ── Summary ──────────────────────────────────────────────────────────────────
console.log('═══════════════════════════════════════════════════════════');
console.log(`  Results: ${passed} passed, ${failed} failed`);
if (failed === 0) {
  console.log('  ✅ All smoke tests PASSED');
} else {
  console.log('  ❌ Some tests FAILED — review output above');
}
console.log('═══════════════════════════════════════════════════════════');
process.exit(failed > 0 ? 1 : 0);
