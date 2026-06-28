#!/usr/bin/env node
/**
 * Verify PIFH org agent hierarchy invariants.
 *
 * Usage:
 *   node scripts/verify-pifh-org-agent.mjs
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const PIFH_ORG_ID = '00000000-0000-0000-0000-000000000001';
const PIFH_ORG_AGENT_ID = 'dc91befa-0364-49cf-9cfa-b452f0f49a28';
const PIFH_ORG_AGENT_EMAIL = 'membership@payitforwardhealth.com';

function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    try {
      const raw = readFileSync(resolve(process.cwd(), file), 'utf8');
      for (const line of raw.split('\n')) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (!m) continue;
        const key = m[1].trim();
        const val = m[2].trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) process.env[key] = val;
      }
    } catch {
      /* optional */
    }
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let passed = 0;
let failed = 0;

function ok(label) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

function fail(label, detail) {
  failed += 1;
  console.error(`  ✗ ${label}${detail ? `: ${detail}` : ''}`);
}

async function main() {
  console.log('=== PIFH org agent hierarchy verification ===\n');

  const { data: root, error: rootErr } = await supabase
    .from('advisors')
    .select('id, first_name, last_name, email, parent_advisor_id, agent_role, advisor_code, status')
    .eq('id', PIFH_ORG_AGENT_ID)
    .eq('organization_id', PIFH_ORG_ID)
    .maybeSingle();

  if (rootErr) fail('load org agent root', rootErr.message);
  else if (!root) fail('org agent root exists');
  else {
    ok('org agent root exists');
    if (root.parent_advisor_id === null) ok('root has no parent');
    else fail('root has no parent', `parent=${root.parent_advisor_id}`);
    if (root.email === PIFH_ORG_AGENT_EMAIL) ok('root email is membership@payitforwardhealth.com');
    else fail('root email', root.email);
    if (root.agent_role === 'Agency') ok('root agent_role is Agency');
    else fail('root agent_role', root.agent_role);
    if (root.advisor_code === 'PIFH-0000') ok('root advisor_code is PIFH-0000');
    else fail('root advisor_code', root.advisor_code);
  }

  const { data: advisors, error: advErr } = await supabase
    .from('advisors')
    .select('id, parent_advisor_id')
    .eq('organization_id', PIFH_ORG_ID);

  if (advErr) fail('load PIFH advisors', advErr.message);
  else {
    const total = advisors.length;
    const roots = advisors.filter((a) => a.parent_advisor_id === null);
    const underOrg = advisors.filter((a) => a.parent_advisor_id === PIFH_ORG_AGENT_ID);
    const orphans = advisors.filter(
      (a) => a.id !== PIFH_ORG_AGENT_ID && a.parent_advisor_id !== PIFH_ORG_AGENT_ID,
    );

    ok(`PIFH advisor count ${total}`);
    if (roots.length === 1 && roots[0].id === PIFH_ORG_AGENT_ID) {
      ok('exactly one root advisor');
    } else {
      fail('exactly one root advisor', `roots=${roots.length}`);
    }
    if (underOrg.length === total - 1) {
      ok(`all ${total - 1} non-root advisors wired under org agent`);
    } else {
      fail('non-root advisors wired under org agent', `wired=${underOrg.length}, orphans=${orphans.length}`);
    }
  }

  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', PIFH_ORG_ID)
    .maybeSingle();

  if (orgErr) fail('load org settings', orgErr.message);
  else if (org?.settings?.default_org_agent_id === PIFH_ORG_AGENT_ID) {
    ok('organizations.settings.default_org_agent_id set');
  } else {
    fail('organizations.settings.default_org_agent_id', org?.settings?.default_org_agent_id ?? 'missing');
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
