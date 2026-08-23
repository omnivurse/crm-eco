#!/usr/bin/env node
/**
 * dump-prod-fixture-shapes.mjs — READ-ONLY snapshot of the PIFH org's CRM
 * CONFIGURATION on prod, written to scripts/e2e/fixture-shapes.json so the
 * local walk fixture (seed-walk-fixture.mjs) mirrors prod instead of
 * inventing config.
 *
 * Reads ONLY config tables: crm_modules, crm_fields, crm_views, crm_layouts,
 * crm_feature_flags, crm_status_vocabulary, plus a few aggregate COUNTS.
 * No crm_records / profiles / members rows are read — no PII can land in the
 * output. The service-role key is taken from the env or apps/crm/.env.local /
 * .env (same pattern as scripts/audit-crm-visibility.mjs) and is never printed.
 *
 *   node scripts/e2e/dump-prod-fixture-shapes.mjs            # writes fixture-shapes.json
 *   node scripts/e2e/dump-prod-fixture-shapes.mjs --stdout   # print instead
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../..');
const ORG_ID = '00000000-0000-0000-0000-000000000001';

function fromEnvFile(file, key) {
  if (!existsSync(file)) return null;
  const line = readFileSync(file, 'utf8').split('\n').find((l) => l.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1).trim().replace(/^["']|["']$/g, '') : null;
}
const envFiles = [path.join(REPO_ROOT, 'apps/crm/.env.local'), path.join(REPO_ROOT, '.env')];
const pick = (key) => process.env[key] || envFiles.map((f) => fromEnvFile(f, key)).find(Boolean) || null;
const URL = pick('NEXT_PUBLIC_SUPABASE_URL');
const KEY = pick('SUPABASE_SERVICE_ROLE_KEY');
if (!URL || !KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(2);
}
const sb = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const must = ({ data, error }) => { if (error) throw new Error(error.message); return data ?? []; };

const modules = must(await sb.from('crm_modules')
  .select('id,key,name,name_plural,icon,description,is_system,is_enabled,display_order')
  .eq('org_id', ORG_ID).order('display_order').order('key'));
const modById = new Map(modules.map((m) => [m.id, m.key]));
const modIds = modules.map((m) => m.id);

const fieldsRaw = must(await sb.from('crm_fields')
  .select('module_id,key,label,type,required,is_system,is_indexed,is_title_field,options,validation,default_value,tooltip,display_order,section,width,is_pinned,metadata')
  .in('module_id', modIds).order('display_order').order('key').limit(5000));
const views = must(await sb.from('crm_views')
  .select('id,module_id,name,columns,filters,sort,is_default,is_shared,created_by')
  .eq('org_id', ORG_ID).order('name'));
const layouts = must(await sb.from('crm_layouts')
  .select('id,module_id,name,is_default,config').eq('org_id', ORG_ID).order('name'));
const flags = must(await sb.from('crm_feature_flags')
  .select('organization_id,flag_key,enabled,rollout_percentage,description').order('flag_key'));
const vocab = must(await sb.from('crm_status_vocabulary').select('module_key,statuses').eq('org_id', ORG_ID));

// Aggregates only (no row content).
async function countRows(table, filter) {
  let q = sb.from(table).select('id', { count: 'exact', head: true });
  for (const [k, v] of Object.entries(filter ?? {})) q = q.eq(k, v);
  const { count, error } = await q;
  return error ? `error: ${error.message}` : count;
}
const recordCounts = {};
for (const m of modules) recordCounts[m.key] = await countRows('crm_records', { org_id: ORG_ID, module_id: m.id });
const aggregates = {
  crm_records_by_module: recordCounts,
  crm_advisors_active: await countRows('crm_advisors', { is_active: true }),
  advisors_rows: await countRows('advisors', { organization_id: ORG_ID }),
};

const strip = (row) => { const { module_id, id, ...rest } = row; return { module_key: modById.get(module_id), ...(id ? { prod_id: id } : {}), ...rest }; };
const out = {
  _meta: {
    source: 'prod PIFH org 00000000-0000-0000-0000-000000000001 (config tables only, read-only)',
    captured_at: new Date().toISOString(),
    note: 'Template for scripts/e2e/seed-walk-fixture.mjs. No record/PII data. Regenerate with scripts/e2e/dump-prod-fixture-shapes.mjs.',
  },
  modules: modules.map(({ id, ...m }) => ({ prod_id: id, ...m })),
  fields: fieldsRaw.map(strip),
  views: views.map(strip),
  layouts: layouts.map(strip),
  feature_flags: flags.map((f) => ({ ...f, scope: f.organization_id === null ? 'global' : f.organization_id === ORG_ID ? 'pifh' : 'other-org' })),
  status_vocabulary: vocab,
  aggregates,
};
const json = JSON.stringify(out, null, 2) + '\n';
if (process.argv.includes('--stdout')) process.stdout.write(json);
else {
  const target = path.join(HERE, 'fixture-shapes.json');
  writeFileSync(target, json);
  console.log(`wrote ${target}: modules=${modules.length} fields=${fieldsRaw.length} views=${views.length} layouts=${layouts.length} flags=${flags.length} vocab=${vocab.length}`);
  console.log('record counts:', JSON.stringify(recordCounts), 'aggregates:', JSON.stringify({ crm_advisors_active: aggregates.crm_advisors_active, advisors_rows: aggregates.advisors_rows }));
}
