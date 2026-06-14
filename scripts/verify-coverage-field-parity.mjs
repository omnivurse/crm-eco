#!/usr/bin/env node
/**
 * Verify Leads / Contacts / Members have coverage fields + layout parity.
 * Run: node scripts/verify-coverage-field-parity.mjs
 * Exit 1 if any person module would hide insurance UI after lead conversion.
 */

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

for (const f of ['.env.local', '.env']) {
  try {
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (!m) continue;
      const k = m[1].trim();
      if (!process.env[k]) process.env[k] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  } catch {}
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

const PERSON_MODULES = ['leads', 'contacts', 'members'];
const REQUIRED_KEYS = [
  'sharing_entity',
  'member_tier',
  'monthly_contribution',
  'iua_amount',
  'sharing_effective_date',
  'sharing_status',
  'sharing_member_id',
  'previous_membership',
  'health_insurance_carrier',
  'health_insurance_plan_name',
  'health_insurance_premium',
  'health_insurance_start_date',
  'health_insurance_end_date',
  'health_insurance_status',
];
const COVERAGE_SECTIONS = new Set([
  'health_sharing',
  'health_insurance',
  'insurance',
  'insurance_coverage',
  'dental_coverage',
  'vision_coverage',
  'other_coverage',
  'life_coverage',
  'product',
]);

const { data: modules, error: modErr } = await sb
  .from('crm_modules')
  .select('id, key, organization_id')
  .in('key', PERSON_MODULES)
  .eq('is_enabled', true);

if (modErr) {
  console.error(modErr.message);
  process.exit(1);
}

const issues = [];

for (const mod of modules ?? []) {
  const { data: fields } = await sb
    .from('crm_fields')
    .select('key, section')
    .eq('module_id', mod.id);
  const { data: layout } = await sb
    .from('crm_layouts')
    .select('config')
    .eq('module_id', mod.id)
    .eq('is_default', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const byKey = new Map((fields ?? []).map((f) => [f.key, f.section]));
  const layoutSections = (layout?.config?.sections ?? []).map((s) => s.key);

  for (const req of REQUIRED_KEYS) {
    if (!byKey.has(req)) {
      issues.push(`${mod.key}: missing crm_fields row for "${req}"`);
    } else {
      const section = byKey.get(req);
      if (!COVERAGE_SECTIONS.has(section)) {
        issues.push(`${mod.key}: "${req}" in section "${section}" (expected coverage section)`);
      }
    }
  }

  for (const sectionKey of layoutSections) {
    if (!COVERAGE_SECTIONS.has(sectionKey)) continue;
    const count = (fields ?? []).filter((f) => f.section === sectionKey).length;
    if (count === 0) {
      issues.push(`${mod.key}: layout lists "${sectionKey}" but zero crm_fields in that section`);
    }
  }
}

if (issues.length === 0) {
  console.log('OK — coverage field parity verified for', (modules ?? []).map((m) => m.key).join(', '));
  process.exit(0);
}

console.error('Coverage field parity FAILED:\n' + issues.map((i) => `  - ${i}`).join('\n'));
process.exit(1);
