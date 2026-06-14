#!/usr/bin/env node
/**
 * Post-migration verification for Supabase database linter remediation.
 *
 * Usage (requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY):
 *   node scripts/verify-linter-remediation.mjs
 *
 * Read-only checks against live DB via PostgREST / SQL RPC if available.
 * Falls back to REST introspection where possible.
 */

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const SEARCH_PATH_FNS = [
  '_crm_jsonb_value_is_blank', '_parse_import_date', 'auto_link_email_thread',
  'cancel_future_billing_on_enrollment_cancelled', 'check_approval_required',
  'complete_job', 'compute_first_billing_date', 'create_enrollment_tx',
  'create_signup_commission_on_enrollment', 'crm_records_init_stage_updated_at',
  'crm_records_set_stage_updated_at', 'emit_integration_event',
  'find_or_create_contact_by_email', 'generate_billing_schedule_on_enrollment_active',
  'get_pending_jobs', 'notify_member_on_need_status_change', 'queue_integration_job',
  'recompute_advisor_tier_on_membership_change', 'set_updated_at',
  'set_updated_at_member_portal', 'sync_billing_schedule_on_enrollment_update',
  'sync_org_tenant_key', 'update_billing_automation_config_updated_at',
  'update_email_thread_stats',
];

const MATERIALIZED_VIEWS = [
  'mv_org_monthly_dashboard',
  'mv_advisor_monthly_performance',
  'executive_top_advisor_mv',
  'executive_kpi_mv',
];

const SAMPLE_RPC_SMOKE = [
  { fn: 'get_executive_kpis', args: { p_org_id: '00000000-0000-0000-0000-000000000001', p_month: null } },
  { fn: 'health_check', args: {} },
  { fn: 'calculate_premium', args: { p_plan_id: '00000000-0000-0000-0000-000000000001', p_age: 35, p_tobacco: false } },
];

async function sql(query) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  // Direct SQL not available via REST without pg_net — use pg_catalog via custom verify fn if deployed
  void res;
  void query;
  return null;
}

async function rpc(fn, args) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args ?? {}),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, ok: res.ok, data };
}

async function checkMvDirectAccess(view) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${view}?select=*&limit=1`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
  });
  return { view, status: res.status, blocked: res.status === 401 || res.status === 403 };
}

async function main() {
  console.log('=== Linter Remediation Verification ===');
  console.log('Target:', SUPABASE_URL);
  console.log('');

  console.log('--- Materialized view direct access (service_role should work) ---');
  for (const view of MATERIALIZED_VIEWS) {
    const r = await checkMvDirectAccess(view);
    console.log(`  ${view}: HTTP ${r.status}${r.blocked ? ' (blocked — unexpected for service_role)' : ' (accessible)'}`);
  }

  console.log('');
  console.log('--- RPC smoke (service_role; errors OK if bad test UUIDs) ---');
  for (const { fn, args } of SAMPLE_RPC_SMOKE) {
    const r = await rpc(fn, args);
    console.log(`  ${fn}: HTTP ${r.status} ${r.ok ? 'OK' : 'FAIL'}`);
    if (!r.ok && typeof r.data === 'object' && r.data?.message) {
      console.log(`    ${r.data.message}`);
    }
  }

  console.log('');
  console.log('--- Manual SQL checks (run in Supabase SQL editor) ---');
  console.log(`
-- 1) Remaining search_path gaps among flagged functions:
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = ANY(ARRAY[${SEARCH_PATH_FNS.map((f) => `'${f}'`).join(', ')}])
  AND (p.proconfig IS NULL OR NOT EXISTS (
    SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%'
  ));

-- 2) MV grants to anon/authenticated should be empty:
SELECT grantee, privilege_type, table_name
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (${MATERIALIZED_VIEWS.map((v) => `'${v}'`).join(', ')})
  AND grantee IN ('anon', 'authenticated');

-- 3) Internal functions should not be executable by anon:
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_roles r ON r.oid = p.proowner
WHERE n.nspname = 'public'
  AND p.proname IN ('get_pending_jobs', 'complete_job', 'emit_integration_event')
  AND has_function_privilege('anon', p.oid, 'EXECUTE');
`);

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
