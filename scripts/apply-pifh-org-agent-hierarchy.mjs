#!/usr/bin/env node
/**
 * Apply PIFH org agent hierarchy backfill (production data write).
 *
 * Usage:
 *   node scripts/apply-pifh-org-agent-hierarchy.mjs --dry-run
 *   node scripts/apply-pifh-org-agent-hierarchy.mjs --apply
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

const dryRun = process.argv.includes('--dry-run');
const apply = process.argv.includes('--apply');

if (!dryRun && !apply) {
  console.error('Pass --dry-run or --apply');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const { data: advisors, error } = await supabase
    .from('advisors')
    .select('id, parent_advisor_id, email, first_name, last_name')
    .eq('organization_id', PIFH_ORG_ID);

  if (error) throw error;

  const toWire = advisors.filter(
    (a) => a.id !== PIFH_ORG_AGENT_ID && a.parent_advisor_id !== PIFH_ORG_AGENT_ID,
  );

  console.log(`PIFH advisors: ${advisors.length}`);
  console.log(`Would wire under org agent: ${toWire.length}`);
  console.log(`Org agent id: ${PIFH_ORG_AGENT_ID}`);
  console.log(`Org agent email: ${PIFH_ORG_AGENT_EMAIL}`);

  if (dryRun) {
    console.log('\nDry run only — no writes performed.');
    return;
  }

  const { error: rootErr } = await supabase
    .from('advisors')
    .update({
      first_name: 'Pay It Forward Health',
      last_name: 'House',
      email: PIFH_ORG_AGENT_EMAIL,
      company_name: 'Pay It Forward Health',
      agency_name: 'Pay It Forward Health',
      agent_role: 'Agency',
      status: 'active',
      parent_advisor_id: null,
      advisor_code: 'PIFH-0000',
      updated_at: new Date().toISOString(),
    })
    .eq('id', PIFH_ORG_AGENT_ID)
    .eq('organization_id', PIFH_ORG_ID);

  if (rootErr) throw rootErr;
  console.log('Updated org agent root row.');

  const batchSize = 100;
  let wired = 0;
  for (let i = 0; i < toWire.length; i += batchSize) {
    const batch = toWire.slice(i, i + batchSize);
    const ids = batch.map((a) => a.id);
    const { error: batchErr } = await supabase
      .from('advisors')
      .update({
        parent_advisor_id: PIFH_ORG_AGENT_ID,
        updated_at: new Date().toISOString(),
      })
      .in('id', ids)
      .eq('organization_id', PIFH_ORG_ID);

    if (batchErr) throw batchErr;
    wired += batch.length;
    console.log(`Wired ${wired}/${toWire.length} advisors...`);
  }

  const { data: org, error: orgLoadErr } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', PIFH_ORG_ID)
    .single();

  if (orgLoadErr) throw orgLoadErr;

  const settings = {
    ...(org.settings && typeof org.settings === 'object' ? org.settings : {}),
    default_org_agent_id: PIFH_ORG_AGENT_ID,
  };

  const { error: orgErr } = await supabase
    .from('organizations')
    .update({ settings, updated_at: new Date().toISOString() })
    .eq('id', PIFH_ORG_ID);

  if (orgErr) throw orgErr;
  console.log('Updated organizations.settings.default_org_agent_id.');
  console.log('\nDone. Run: node scripts/verify-pifh-org-agent.mjs');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
