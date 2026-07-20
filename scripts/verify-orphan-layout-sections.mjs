#!/usr/bin/env node
/**
 * Fail if any crm_layouts section has zero fields AND is not a coverage
 * force-show band (the class of orphan that produced empty Overview cards).
 *
 * Run: node scripts/verify-orphan-layout-sections.mjs
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
  } catch {
    /* optional env file */
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const COVERAGE_KEYS = new Set([
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

const sb = createClient(url, key, { auth: { persistSession: false } });

const { data: layouts, error: layoutErr } = await sb
  .from('crm_layouts')
  .select('id, name, is_default, module_id, config, crm_modules!inner(key, organization_id)');

if (layoutErr) {
  console.error(layoutErr.message);
  process.exit(1);
}

const { data: fields, error: fieldErr } = await sb.from('crm_fields').select('module_id, section');
if (fieldErr) {
  console.error(fieldErr.message);
  process.exit(1);
}

const fieldsByModule = new Map();
for (const f of fields ?? []) {
  if (!f.section) continue;
  if (!fieldsByModule.has(f.module_id)) fieldsByModule.set(f.module_id, new Set());
  fieldsByModule.get(f.module_id).add(f.section);
}

const issues = [];
for (const layout of layouts ?? []) {
  const moduleKey = layout.crm_modules?.key ?? '?';
  const present = fieldsByModule.get(layout.module_id) ?? new Set();
  const sections = layout.config?.sections ?? [];
  for (const section of sections) {
    const key = section?.key;
    if (!key || COVERAGE_KEYS.has(key)) continue;
    if (!present.has(key)) {
      issues.push(
        `${moduleKey} / ${layout.name}${layout.is_default ? ' (default)' : ''}: orphan section "${key}"`,
      );
    }
  }
}

if (issues.length === 0) {
  console.log('OK — no orphan non-coverage layout sections');
  process.exit(0);
}

console.error('Orphan layout sections FOUND:\n' + issues.map((i) => `  - ${i}`).join('\n'));
process.exit(1);
