#!/usr/bin/env node
/**
 * Verify lead → contact conversion RPCs, links, and field parity.
 *
 * Usage:
 *   node scripts/verify-lead-contact-conversion.mjs
 *   node scripts/verify-lead-contact-conversion.mjs --org <uuid>
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env / .env.local
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

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

const INSURANCE_KEYS = [
  'sharing_entity',
  'carrier',
  'group_name',
  'health_insurance_carrier',
  'health_insurance_plan_name',
  'sharing_effective_date',
  'health_insurance_start_date',
  'member_tier',
  'monthly_contribution',
  'iua_amount',
];

const FAMILY_KEYS = ['spouse', 'spouse_dob', 'child_1', 'mailing_street', 'mailing_city', 'mailing_state'];

function isBlank(v) {
  return v === null || v === undefined || v === '' || v === 'null';
}

function valueMissingOnContact(leadVal, contactVal) {
  if (isBlank(leadVal)) return false;
  return isBlank(contactVal);
}

loadEnv();

const orgArgIdx = process.argv.indexOf('--org');
const orgFilter = orgArgIdx >= 0 ? process.argv[orgArgIdx + 1] : null;

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
let warned = 0;

function ok(label) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

function fail(label, detail) {
  failed += 1;
  console.log(`  ✗ ${label}${detail ? `: ${detail}` : ''}`);
}

function warn(label, detail) {
  warned += 1;
  console.log(`  ⚠ ${label}${detail ? `: ${detail}` : ''}`);
}

async function main() {
  console.log('\n=== Lead → Contact Conversion Verification ===\n');
  console.log(`Project: ${url}\n`);

  // RPC existence
  const fakeId = '00000000-0000-0000-0000-000000000001';
  const { data: convertProbe } = await supabase.rpc('convert_lead_to_contact', {
    p_lead_record_id: fakeId,
    p_user_id: fakeId,
  });
  if (convertProbe?.error === 'Lead record not found') ok('convert_lead_to_contact RPC callable');
  else fail('convert_lead_to_contact RPC', JSON.stringify(convertProbe));

  const { data: repairProbe } = await supabase.rpc('repair_converted_contact_insurance_data', {
    p_contact_id: fakeId,
  });
  if (repairProbe?.error === 'Contact not found') ok('repair_converted_contact_insurance_data RPC callable');
  else fail('repair_converted_contact_insurance_data RPC', JSON.stringify(repairProbe));

  const { data: memberProbe } = await supabase.rpc('convert_lead_to_member', {
    p_lead_record_id: fakeId,
    p_user_id: fakeId,
  });
  if (memberProbe?.error === 'Lead record not found') ok('convert_lead_to_member RPC callable');
  else fail('convert_lead_to_member RPC', JSON.stringify(memberProbe));

  // Load lead→contact links
  let linksQuery = supabase
    .from('crm_record_links')
    .select('source_record_id, target_record_id, organization_id, org_id')
    .eq('link_type', 'lead_to_contact')
    .limit(200);

  const { data: links, error: linksErr } = await linksQuery;
  if (linksErr) {
    fail('load crm_record_links', linksErr.message);
  } else {
    ok(`found ${links?.length ?? 0} lead_to_contact link(s)`);
  }

  const linkRows = links ?? [];
  let parityIssues = 0;
  let stageIssues = 0;
  let inconsistentStatus = 0;

  for (const link of linkRows) {
    const orgId = link.organization_id || link.org_id;
    if (orgFilter && orgId !== orgFilter) continue;

    const [{ data: lead }, { data: contact }] = await Promise.all([
      supabase.from('crm_records').select('id, status, stage, data, org_id, organization_id').eq('id', link.source_record_id).maybeSingle(),
      supabase.from('crm_records').select('id, status, data, carrier_id, market_type').eq('id', link.target_record_id).maybeSingle(),
    ]);

    if (!lead || !contact) {
      fail('link pair missing record', `${link.source_record_id} → ${link.target_record_id}`);
      continue;
    }

    const ld = lead.data ?? {};
    const cd = contact.data ?? {};

    if (lead.status !== 'Converted') inconsistentStatus += 1;
    if (lead.stage !== 'Converted') stageIssues += 1;

    const missing = [...INSURANCE_KEYS, ...FAMILY_KEYS].filter((k) =>
      valueMissingOnContact(ld[k], cd[k]),
    );
    if (missing.length > 0) {
      parityIssues += 1;
      warn(`contact ${contact.id} missing fields from lead ${lead.id}`, missing.join(', '));
    }
  }

  if (parityIssues === 0) ok('all sampled link pairs have insurance/family field parity');
  else warn(`${parityIssues} contact(s) with missing copied fields (run repair backfill)`);

  if (stageIssues === 0) ok('all linked leads have stage=Converted');
  else warn(`${stageIssues} converted lead(s) missing stage=Converted (apply 202606150003 backfill)`);

  if (inconsistentStatus === 0) ok('all linked leads have status=Converted');
  else warn(`${inconsistentStatus} linked lead(s) with status != Converted`);

  // Orphan markers: converted flags without link
  const { data: leadsModule } = await supabase
    .from('crm_modules')
    .select('id')
    .eq('key', 'leads')
    .limit(1)
    .maybeSingle();

  if (leadsModule?.id) {
    const { count: markerCount } = await supabase
      .from('crm_records')
      .select('id', { count: 'exact', head: true })
      .eq('module_id', leadsModule.id)
      .neq('status', 'Converted')
      .or('data->>is_converted.eq.true,data->>lead_status.eq.Converted');

    if ((markerCount ?? 0) === 0) ok('no leads with converted markers but open status');
    else warn(`${markerCount} lead(s) have converted markers but status != Converted`);
  }

  console.log('\n--- Summary ---');
  console.log(`Passed: ${passed}  Failed: ${failed}  Warnings: ${warned}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
