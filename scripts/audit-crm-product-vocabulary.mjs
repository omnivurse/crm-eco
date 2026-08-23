#!/usr/bin/env node
/**
 * DE-9 census: what PIFH actually stores for the Health Sharing Membership /
 * product, the health-insurance plan name and the producer (enrolled-by) name,
 * clustered by spelling, plus how many producers resolve to an advisor record.
 *
 *   node scripts/audit-crm-product-vocabulary.mjs                 # report to stdout
 *   node scripts/audit-crm-product-vocabulary.mjs --json <path>   # + machine-readable proposal
 *   node scripts/audit-crm-product-vocabulary.mjs --md <path>     # + markdown tables
 *   node scripts/audit-crm-product-vocabulary.mjs --top 60        # rows per table (default 40)
 *   node scripts/audit-crm-product-vocabulary.mjs --min-count 10  # tier-A threshold for proposed options (default 10)
 *
 * READ-ONLY. Never writes to the database and never prints the key. Same
 * env/client/paging as scripts/audit-crm-vocabulary.mjs (PostgREST with the
 * service key from apps/crm/.env.local, 1000-row pages because PostgREST
 * truncates silently). Always exits 0 — this is a census, not a check.
 *
 * Decision context: docs/ux/decisions-2026-08-22.md D3 (product = closed
 * Select + "Other…", admin-maintained crm_fields.options seeded from this
 * census), D4 (health-insurance plan stays free text), D5 (producer store =
 * CRM `advisors` crm_records module, producer_record_id alongside
 * producer_name). No record value is rewritten; legacy spellings keep showing
 * through DE-1's current-value option.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ORG = '00000000-0000-0000-0000-000000000001';
const MODULES = ['contacts', 'leads', 'members'];

/** Field key that carries the Health Sharing Membership / product per module. */
export const PRODUCT_KEYS = { contacts: 'product', leads: 'product_type', members: 'plan_name' };
export const PLAN_KEY = 'health_insurance_plan_name';
export const PRODUCER_KEY = 'producer_name';
/** Neighbouring keys that are NOT the decision target but explain the data. */
const ADJACENT_KEYS = {
  contacts: ['product_type', 'producer', 'advisor_name'],
  leads: ['producer', 'advisor', 'agent'],
  members: ['advisor_name', 'plan_type', 'producer'],
};

// ─── CLI / env ──────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const argValue = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : undefined; };
const jsonOut = argValue('--json');
const mdOut = argValue('--md');
const TOP = Number(argValue('--top') ?? 40);
/** Clusters with at least this many records are proposed as picklist options (tier A); smaller ones stay legacy-display-only (tier B) unless the owner promotes them. */
const MIN_OPTION_COUNT = Number(argValue('--min-count') ?? 10);

const envPath = path.resolve(process.cwd(), 'apps/crm/.env.local');
const env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const getEnv = (k) => process.env[k] ?? (env.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim().replace(/^['"]|['"]$/g, '');
const SB_URL = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');
if (!SB_URL || !KEY) { console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(2); }
const sb = createClient(SB_URL, KEY, { auth: { persistSession: false } });

// ─── Normalisation (pure, exported for reuse) ───────────────────────────────
const ACRONYMS = new Set(['HSA', 'MEC', 'MEC+', 'MPB', 'DPC', 'OPD', 'VPC', 'PPO', 'HMO', 'EPO', 'ASSOC', 'CV', 'DPC-', 'T1', 'T2', 'T3', 'C4HCO', 'HES', 'ARM', 'ASI', 'MD', 'PA', 'DDS', 'DC', 'LLC', 'INC', 'PLLC', 'PLC', 'PC', 'RI', 'DM', 'ASHI', 'WWSRA', 'HSLDA', 'API']);
const CORPORATE = /\b(inc|llc|l\.l\.c|ltd|corp|corporation|incorporated|company|co|plc|pllc|pc|pa|group|enterprises|industries|solutions|services|associates|partners|holdings|ventures|clinic|chiropractic|church|construction|university|institute|leads|sales|agency|benefits|employees?|homes|flooring|trucking|dental|orthodontics|insurance|medical|health|wellness|law|cpa|dds|md)\b/i;

/** Collapse whitespace and trim. */
const squash = (s) => String(s).replace(/\s+/g, ' ').trim();

/**
 * Product cluster key: case/whitespace/punctuation-insensitive, with the plan
 * code — "(45800)", "- 35768" — and the plan year ("2024") removed, and the
 * common abbreviation pairs folded (co-pay/copay, care +/care plus, mec +/mec+).
 */
export function productClusterKey(raw) {
  let s = squash(raw).toLowerCase();
  s = s.replace(/[\s-]*\(\s*\d{3,6}\s*\)\s*$/, '');        // "(45800)" suffix
  s = s.replace(/\s*-\s*\d{3,6}\s*$/, '');                  // "- 35768" suffix
  s = s.replace(/\b20\d\d\b/g, ' ');                         // plan year
  s = s.replace(/\bco-?\s?pay\b/g, 'copay');
  s = s.replace(/\bcare\s*\+/g, 'care plus');
  s = s.replace(/\bmec\s*\+/g, 'mec+');
  s = s.replace(/\s*-\s*/g, ' ');                             // dashes → space
  s = s.replace(/[.,'"*:;]/g, ' ');
  return squash(s);
}

/** Display label for a cluster: most frequent spelling minus code/year, acronym-aware title case. */
export function productCanonicalLabel(raw) {
  let s = squash(raw);
  s = s.replace(/[\s-]*\(\s*\d{3,6}\s*\)\s*$/, '');
  s = s.replace(/\s*-\s*\d{3,6}\s*$/, '');
  s = s.replace(/\s*\b20\d\d\b\s*/g, ' ');
  s = s.replace(/\s+-\s*$/, '');
  s = squash(s);
  if (s === s.toUpperCase() && /[A-Z]{3,}/.test(s)) {
    s = s.split(' ').map((w) => {
      const bare = w.replace(/[()]/g, '');
      if (ACRONYMS.has(bare) || (/^[A-Z]{2,4}$/.test(bare))) return w;
      return w.charAt(0) + w.slice(1).toLowerCase();
    }).join(' ');
  }
  return s;
}

/**
 * Producer cluster key: the *person* part of "Advisor - Client Company",
 * "Advisor MPB Leads", "Company - Advisor"; lowercase, punctuation-light.
 * Hyphenated surnames ("Adams-Waneka") survive because only a hyphen with an
 * adjacent space (or a slash) splits.
 */
export function producerPerson(raw) {
  let s = squash(raw).replace(/\*+$/, '');
  const parts = s.split(/\s+-\s*|-\s+|\s*\/\s*/).map(squash).filter(Boolean);
  if (parts.length > 1) s = parts.find((p) => !CORPORATE.test(p)) ?? parts[0];
  s = s.replace(/\b(mpb\s+(sales[- ]?)?leads?|mpb\s+sales)\b/gi, ' ');
  return squash(s);
}
export function producerClusterKey(raw) {
  return squash(producerPerson(raw).toLowerCase().replace(/[.,'"()*]/g, ' '));
}

/** Strict person-name key used when matching producers to advisor rows. */
export const nameKey = (s) => squash(String(s ?? '').toLowerCase().replace(/[^a-z0-9 ]/g, ' '));

// ─── Load ───────────────────────────────────────────────────────────────────
const { data: modules, error: mErr } = await sb.from('crm_modules').select('*').eq('org_id', ORG);
if (mErr) { console.error(mErr.message); process.exit(2); }
const moduleKey = Object.fromEntries(modules.map((m) => [m.id, m.key]));

const { data: fields, error: fErr } = await sb.from('crm_fields').select('id,module_id,key,label,type,options').eq('org_id', ORG);
if (fErr) { console.error(fErr.message); process.exit(2); }
const fieldByModKey = {};
for (const f of fields) fieldByModKey[`${moduleKey[f.module_id]}.${f.key}`] = f;

const rows = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb
    .from('crm_records')
    .select('id,module_id,title,data')
    .eq('org_id', ORG).is('deleted_at', null)
    .order('id').range(from, from + 999);
  if (error) { console.error(error.message); process.exit(2); }
  rows.push(...data);
  if (data.length < 1000) break;
}

// Advisor stores (D5): CRM `advisors` crm_records module (target), public.advisors (legacy roster), crm_advisors (DEPRECATED).
const advisorRecords = rows.filter((r) => moduleKey[r.module_id] === 'advisors');
const advisorRecordNames = new Set(advisorRecords.map((r) => nameKey(r.title || `${r.data?.first_name ?? ''} ${r.data?.last_name ?? ''}`)).filter(Boolean));
const publicAdvisors = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb.from('advisors').select('id,first_name,last_name,full_name,is_active,deleted_at').eq('organization_id', ORG).order('id').range(from, from + 999);
  if (error) { console.error('public.advisors:', error.message); break; }
  publicAdvisors.push(...data);
  if (data.length < 1000) break;
}
const livePublicAdvisors = publicAdvisors.filter((a) => !a.deleted_at);
const publicAdvisorNames = new Set(livePublicAdvisors.flatMap((a) => [nameKey(a.full_name), nameKey(`${a.first_name ?? ''} ${a.last_name ?? ''}`)]).filter(Boolean));
const { count: crmAdvisorsCount } = await sb.from('crm_advisors').select('*', { count: 'exact', head: true }).eq('organization_id', ORG);

// ─── Census helpers ─────────────────────────────────────────────────────────
const sum = (arr, f) => arr.reduce((n, x) => n + f(x), 0);
const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1)}%` : 'n/a');
const counts = (mod, key) => {
  const m = new Map();
  let total = 0;
  for (const r of rows) {
    if (moduleKey[r.module_id] !== mod) continue;
    const v = r.data?.[key];
    if (v == null || String(v).trim() === '') continue;
    const s = String(v);
    m.set(s, (m.get(s) ?? 0) + 1); total += 1;
  }
  return { total, values: [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])) };
};
const clusterize = (valueLists, keyFn, labelFn) => {
  // valueLists: [{ mod, values: [[raw, n]] }]
  const clusters = new Map();
  for (const { mod, values } of valueLists) {
    for (const [raw, n] of values) {
      const k = keyFn(raw);
      const c = clusters.get(k) ?? { key: k, total: 0, perModule: {}, spellings: new Map() };
      c.total += n; c.perModule[mod] = (c.perModule[mod] ?? 0) + n;
      const sp = c.spellings.get(raw) ?? { raw, total: 0, perModule: {} };
      sp.total += n; sp.perModule[mod] = (sp.perModule[mod] ?? 0) + n;
      c.spellings.set(raw, sp);
      clusters.set(k, c);
    }
  }
  return [...clusters.values()].map((c) => {
    const spellings = [...c.spellings.values()].sort((a, b) => b.total - a.total || a.raw.localeCompare(b.raw));
    return { ...c, spellings, label: labelFn(spellings[0].raw) };
  }).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
};

const recordCount = (mod) => rows.filter((r) => moduleKey[r.module_id] === mod).length;

// ─── 1. Product / Health Sharing Membership ─────────────────────────────────
const productCensus = {};
for (const mod of MODULES) productCensus[mod] = { key: PRODUCT_KEYS[mod], field: fieldByModKey[`${mod}.${PRODUCT_KEYS[mod]}`] ?? null, ...counts(mod, PRODUCT_KEYS[mod]) };
const productClusters = clusterize(
  MODULES.map((mod) => ({ mod, values: productCensus[mod].values })),
  productClusterKey, productCanonicalLabel,
);

// ─── 2. Producer ────────────────────────────────────────────────────────────
const producerCensus = {};
for (const mod of MODULES) producerCensus[mod] = { key: PRODUCER_KEY, field: fieldByModKey[`${mod}.${PRODUCER_KEY}`] ?? null, ...counts(mod, PRODUCER_KEY) };
const producerClusters = clusterize(
  MODULES.map((mod) => ({ mod, values: producerCensus[mod].values })),
  producerClusterKey, producerPerson,
).map((c) => {
  const matchRecords = c.spellings.some((s) => advisorRecordNames.has(nameKey(s.raw))) || advisorRecordNames.has(nameKey(c.key));
  const matchPublic = c.spellings.some((s) => publicAdvisorNames.has(nameKey(s.raw))) || publicAdvisorNames.has(nameKey(c.key));
  return { ...c, matchAdvisorRecords: matchRecords, matchPublicAdvisors: matchPublic };
});
const producerRawSpellings = new Map();
for (const mod of MODULES) for (const [raw, n] of producerCensus[mod].values) producerRawSpellings.set(raw, (producerRawSpellings.get(raw) ?? 0) + n);
const producerRaw = [...producerRawSpellings.entries()].map(([raw, n]) => ({ raw, n, exactAdvisorRecord: advisorRecordNames.has(nameKey(raw)), exactPublicAdvisor: publicAdvisorNames.has(nameKey(raw)) }));
const producerStats = {
  distinctRaw: producerRaw.length,
  recordsWithProducer: sum(producerRaw, (x) => x.n),
  clusters: producerClusters.length,
  rawExactMatchAdvisorRecords: producerRaw.filter((x) => x.exactAdvisorRecord).length,
  rawExactMatchPublicAdvisors: producerRaw.filter((x) => x.exactPublicAdvisor).length,
  recordsCoveredByAdvisorRecords: sum(producerRaw.filter((x) => x.exactAdvisorRecord), (x) => x.n),
  recordsCoveredByPublicAdvisors: sum(producerRaw.filter((x) => x.exactPublicAdvisor), (x) => x.n),
  clustersMatchAdvisorRecords: producerClusters.filter((c) => c.matchAdvisorRecords).length,
  clustersMatchPublicAdvisors: producerClusters.filter((c) => c.matchPublicAdvisors).length,
  clusterRecordsCoveredByAdvisorRecords: sum(producerClusters.filter((c) => c.matchAdvisorRecords), (c) => c.total),
  clusterRecordsCoveredByPublicAdvisors: sum(producerClusters.filter((c) => c.matchPublicAdvisors), (c) => c.total),
  singletons: producerRaw.filter((x) => x.n === 1).length,
  advisorRecords: advisorRecords.length,
  publicAdvisorsLive: livePublicAdvisors.length,
  publicAdvisorsTotal: publicAdvisors.length,
  crmAdvisors: crmAdvisorsCount ?? 0,
};

// ─── 3. Health-insurance plan name (stays free text, D4) ────────────────────
const planCensus = {};
for (const mod of MODULES) planCensus[mod] = { key: PLAN_KEY, ...counts(mod, PLAN_KEY) };
const planAll = new Map();
for (const mod of MODULES) for (const [raw, n] of planCensus[mod].values) planAll.set(raw, (planAll.get(raw) ?? 0) + n);
const planStats = { distinct: planAll.size, records: sum([...planAll.values()], (n) => n), singletons: [...planAll.values()].filter((n) => n === 1).length };

// ─── 4. Adjacent keys (context only) ────────────────────────────────────────
const adjacent = {};
for (const mod of MODULES) for (const k of ADJACENT_KEYS[mod]) { const c = counts(mod, k); if (c.total) adjacent[`${mod}.${k}`] = { distinct: c.values.length, total: c.total, top: c.values.slice(0, 8) }; }

// ─── Report ─────────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(6);
const host = new URL(SB_URL).host;
console.log(`Census of org ${ORG} on ${host} — ${rows.length} live crm_records (${MODULES.map((m) => `${m} ${recordCount(m)}`).join(', ')}, advisors ${advisorRecords.length}).`);

console.log('\n== 1. Health Sharing Membership / product ==');
for (const mod of MODULES) {
  const c = productCensus[mod];
  console.log(`${mod}.${c.key}: ${c.values.length} distinct spellings on ${c.total}/${recordCount(mod)} records (${pct(c.total, recordCount(mod))})` + (c.field ? ` — crm_fields type=${c.field.type}, options=${Array.isArray(c.field.options) ? c.field.options.length : JSON.stringify(c.field.options)}` : ' — NO crm_fields row'));
}
console.log(`Clusters (case/space/punctuation/plan-code/plan-year folded): ${productClusters.length}`);
for (const c of productClusters.slice(0, TOP)) {
  console.log(`${pad(c.total)}  ${c.label}  [${Object.entries(c.perModule).map(([m, n]) => `${m} ${n}`).join(', ')}]${c.spellings.length > 1 ? `  ← ${c.spellings.length} spellings: ${c.spellings.map((s) => `"${s.raw}"×${s.total}`).join(' | ')}` : ''}`);
}
if (productClusters.length > TOP) console.log(`  … +${productClusters.length - TOP} more`);
const tierA = productClusters.filter((c) => c.total >= MIN_OPTION_COUNT);
console.log(`Tier A (>= ${MIN_OPTION_COUNT} records, proposed options): ${tierA.length} clusters covering ${sum(tierA, (c) => c.total)} of ${sum(productClusters, (c) => c.total)} records (${pct(sum(tierA, (c) => c.total), sum(productClusters, (c) => c.total))}); tier B long tail: ${productClusters.length - tierA.length} clusters.`);

console.log('\n== 2. Producer / Enrolled by ==');
for (const mod of MODULES) { const c = producerCensus[mod]; console.log(`${mod}.${c.key}: ${c.values.length} distinct on ${c.total}/${recordCount(mod)} records` + (c.field ? '' : ' — NO crm_fields row')); }
console.log(`Distinct raw spellings: ${producerStats.distinctRaw} (${producerStats.singletons} used once) on ${producerStats.recordsWithProducer} records; person clusters: ${producerStats.clusters}`);
console.log(`Advisor stores: CRM advisors module ${producerStats.advisorRecords} records · public.advisors ${producerStats.publicAdvisorsLive} live (${producerStats.publicAdvisorsTotal} total) · crm_advisors ${producerStats.crmAdvisors} (DEPRECATED)`);
console.log(`Exact-name match — raw spellings: advisors module ${producerStats.rawExactMatchAdvisorRecords}/${producerStats.distinctRaw} (${pct(producerStats.rawExactMatchAdvisorRecords, producerStats.distinctRaw)}) covering ${producerStats.recordsCoveredByAdvisorRecords} records (${pct(producerStats.recordsCoveredByAdvisorRecords, producerStats.recordsWithProducer)}); public.advisors ${producerStats.rawExactMatchPublicAdvisors}/${producerStats.distinctRaw} (${pct(producerStats.rawExactMatchPublicAdvisors, producerStats.distinctRaw)}) covering ${producerStats.recordsCoveredByPublicAdvisors} records (${pct(producerStats.recordsCoveredByPublicAdvisors, producerStats.recordsWithProducer)})`);
console.log(`Cluster match — advisors module ${producerStats.clustersMatchAdvisorRecords}/${producerStats.clusters} clusters covering ${producerStats.clusterRecordsCoveredByAdvisorRecords} records (${pct(producerStats.clusterRecordsCoveredByAdvisorRecords, producerStats.recordsWithProducer)}); public.advisors ${producerStats.clustersMatchPublicAdvisors}/${producerStats.clusters} covering ${producerStats.clusterRecordsCoveredByPublicAdvisors} records (${pct(producerStats.clusterRecordsCoveredByPublicAdvisors, producerStats.recordsWithProducer)})`);
console.log(`Top ${Math.min(TOP, producerClusters.length)} producer clusters (R = in advisors module, P = in public.advisors):`);
for (const c of producerClusters.slice(0, TOP)) {
  console.log(`${pad(c.total)}  ${c.label}  ${c.matchAdvisorRecords ? 'R' : '-'}${c.matchPublicAdvisors ? 'P' : '-'}${c.spellings.length > 1 ? `  ← ${c.spellings.length} spellings` : ''}`);
}

console.log('\n== 3. Health Insurance Plan (free text per D4) ==');
for (const mod of MODULES) { const c = planCensus[mod]; console.log(`${mod}.${PLAN_KEY}: ${c.values.length} distinct on ${c.total} records`); }
console.log(`Long tail: ${planStats.distinct} distinct across ${planStats.records} records, ${planStats.singletons} used exactly once.`);

console.log('\n== 4. Adjacent keys (context) ==');
for (const [k, v] of Object.entries(adjacent)) console.log(`${k}: ${v.distinct} distinct / ${v.total} records — top: ${v.top.map(([r, n]) => `"${r}"×${n}`).join(', ')}`);

// ─── Outputs ────────────────────────────────────────────────────────────────
const generatedAt = new Date().toISOString();
if (jsonOut) {
  const options = productClusters.map((c, i) => ({
    value: c.label,
    label: c.label,
    tier: c.total >= MIN_OPTION_COUNT ? 'A' : 'B',
    display_order: i,
    count_total: c.total,
    count_by_module: c.perModule,
    spellings: c.spellings.map((s) => ({ raw: s.raw, count: s.total, by_module: s.perModule })),
  }));
  const proposal = {
    $schema: 'crm-eco/product-options-proposal/v1',
    generated_at: generatedAt,
    source: { host, org_id: ORG, live_records: rows.length, script: 'scripts/audit-crm-product-vocabulary.mjs' },
    status: 'PROPOSED — owner must approve the exact list before any prod crm_fields.options write (decisions-2026-08-22.md D3)',
    tiers: { A: `cluster has >= ${MIN_OPTION_COUNT} records — proposed picklist option`, B: 'long tail — keeps displaying via the current-value option; promote only if the owner asks' },
    recommended_min_count: MIN_OPTION_COUNT,
    modules: {
      contacts: { field_key: PRODUCT_KEYS.contacts, field_id: productCensus.contacts.field?.id ?? null, distinct_raw: productCensus.contacts.values.length, records: productCensus.contacts.total },
      leads: { field_key: PRODUCT_KEYS.leads, field_id: productCensus.leads.field?.id ?? null, distinct_raw: productCensus.leads.values.length, records: productCensus.leads.total },
      members: { field_key: PRODUCT_KEYS.members, field_id: productCensus.members.field?.id ?? null, distinct_raw: productCensus.members.values.length, records: productCensus.members.total },
    },
    options,
    other_option: { value: 'Other', label: 'Other…', note: 'explicit free-text escape per D3; UI-level, not stored as a picklist value' },
    producers: {
      store: 'crm_records module advisors (D5); producer_record_id written alongside producer_name',
      ...producerStats,
      // spellings listed only where a cluster folds more than one raw spelling (keeps the file small)
      cluster_list: producerClusters.map((c) => ({ label: c.label, count: c.total, in_advisors_module: c.matchAdvisorRecords, in_public_advisors: c.matchPublicAdvisors, ...(c.spellings.length > 1 ? { spellings: c.spellings.map((s) => [s.raw, s.total]) } : {}) })),
    },
    health_insurance_plan_name: { decision: 'free text + distinct-value suggestions (D4)', ...planStats },
  };
  fs.mkdirSync(path.dirname(jsonOut), { recursive: true });
  fs.writeFileSync(jsonOut, JSON.stringify(proposal, null, 2) + '\n');
  console.log(`\nWrote ${jsonOut}`);
}

if (mdOut) {
  const esc = (s) => String(s).replace(/\|/g, '\\|');
  const L = [];
  L.push(`<!-- generated ${generatedAt} by scripts/audit-crm-product-vocabulary.mjs against ${host}; ${rows.length} live records -->`);
  L.push('', '### Product clusters → proposed options', '', '| # | Tier | Proposed option | Total | contacts | leads | members | Raw spellings folded into it (count) |', '|---|:---:|---|---:|---:|---:|---:|---|');
  productClusters.forEach((c, i) => L.push(`| ${i + 1} | ${c.total >= MIN_OPTION_COUNT ? 'A' : 'B'} | ${esc(c.label)} | ${c.total} | ${c.perModule.contacts ?? 0} | ${c.perModule.leads ?? 0} | ${c.perModule.members ?? 0} | ${c.spellings.map((s) => `\`${esc(s.raw)}\` (${s.total})`).join(', ')} |`));
  L.push('', '### Producer clusters', '', '| # | Producer (person cluster) | Records | In CRM advisors module | In public.advisors | Spellings |', '|---|---|---:|:---:|:---:|---|');
  producerClusters.forEach((c, i) => L.push(`| ${i + 1} | ${esc(c.label)} | ${c.total} | ${c.matchAdvisorRecords ? 'yes' : '—'} | ${c.matchPublicAdvisors ? 'yes' : '—'} | ${c.spellings.length} |`));
  L.push('', '### Health Insurance Plan spellings', '', '| Plan name (raw) | Records |', '|---|---:|');
  [...planAll.entries()].sort((a, b) => b[1] - a[1]).forEach(([r, n]) => L.push(`| ${esc(r)} | ${n} |`));
  fs.mkdirSync(path.dirname(mdOut), { recursive: true });
  fs.writeFileSync(mdOut, L.join('\n') + '\n');
  console.log(`Wrote ${mdOut}`);
}
