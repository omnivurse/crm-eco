#!/usr/bin/env node
/**
 * Standing check: every PIFH record's status is in the agreed vocabulary and
 * the JSONB mirrors agree with the indexed column.
 *
 *   npm run audit:crm-vocabulary           # report, exit 1 on any finding
 *   npm run audit:crm-vocabulary -- --warn # report only
 *
 * Read-only (PostgREST with the service key from apps/crm/.env.local). Pages
 * in 1000s because PostgREST caps rows at 1000 and truncates silently.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ORG = '00000000-0000-0000-0000-000000000001';

// Lifecycle (contacts, members, and any other person module)
export const LIFECYCLE = ['Active','Inactive','Pending','In Process','Cancelled','Terminated','Deceased','Prospect','Lost','Declined','Abandoned'];
// Pipeline (leads status + lead_status everywhere)
export const PIPELINE = ['New','Attempted','Contacted','Qualified','Future Prospect','In Process','Pending','Converted','Unqualified','Lost'];

const envPath = path.resolve(process.cwd(), 'apps/crm/.env.local');
const env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const getEnv = (k) => process.env[k] ?? (env.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim().replace(/^['"]|['"]$/g, '');
const URL = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');
if (!URL || !KEY) { console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(2); }
const warnOnly = process.argv.includes('--warn');
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const { data: modules, error: mErr } = await sb.from('crm_modules').select('id,key').eq('org_id', ORG);
if (mErr) { console.error(mErr.message); process.exit(2); }
const moduleKey = Object.fromEntries(modules.map((m) => [m.id, m.key]));

const rows = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb
    .from('crm_records')
    .select('id,module_id,title,status,data')
    .eq('org_id', ORG).is('deleted_at', null)
    .order('id').range(from, from + 999);
  if (error) { console.error(error.message); process.exit(2); }
  rows.push(...data);
  if (data.length < 1000) break;
}

const findings = { outOfVocabulary: {}, mirrorDisagree: [], nullStatus: [] };
for (const r of rows) {
  const mod = moduleKey[r.module_id] ?? r.module_id;
  const vocab = mod === 'leads' ? PIPELINE : LIFECYCLE;
  const mirrorKey = mod === 'leads' ? 'lead_status' : 'contact_status';
  if (r.status == null || r.status === '') { findings.nullStatus.push({ mod, title: r.title, id: r.id }); continue; }
  // legacy values still awaiting a decision carry legacy_status only once re-labelled;
  // anything outside the vocabulary is a finding regardless of why
  if (!vocab.includes(r.status)) {
    const k = `${mod} · ${r.status}`;
    findings.outOfVocabulary[k] = (findings.outOfVocabulary[k] ?? 0) + 1;
  }
  const mirror = r.data?.[mirrorKey];
  if (mirror != null && mirror !== '' && mirror !== r.status) {
    findings.mirrorDisagree.push({ mod, title: r.title, column: r.status, [mirrorKey]: mirror });
  }
}

const oov = Object.entries(findings.outOfVocabulary).sort((a, b) => b[1] - a[1]);
const oovRecords = oov.reduce((n, [, c]) => n + c, 0);
console.log(`Scanned ${rows.length} live records.`);
console.log(`Out-of-vocabulary: ${oovRecords} records across ${oov.length} values`);
oov.slice(0, 40).forEach(([k, n]) => console.log(`  ${String(n).padStart(6)}  ${k}`));
if (oov.length > 40) console.log(`  … +${oov.length - 40} more`);
console.log(`Column ≠ JSONB mirror: ${findings.mirrorDisagree.length} records`);
findings.mirrorDisagree.slice(0, 10).forEach((f) => console.log('  ', JSON.stringify(f)));
console.log(`Null status: ${findings.nullStatus.length}`);
findings.nullStatus.slice(0, 10).forEach((f) => console.log('  ', JSON.stringify(f)));

const bad = oovRecords + findings.mirrorDisagree.length + findings.nullStatus.length;
if (bad > 0 && !warnOnly) { console.log(`\nFAIL: ${bad} findings`); process.exit(1); }
console.log(bad ? '\nWARN only' : '\nOK: every status is in the vocabulary and every mirror agrees.');
