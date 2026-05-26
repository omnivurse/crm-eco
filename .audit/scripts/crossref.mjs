#!/usr/bin/env node
/**
 * Hawkeye cross-reference.
 *
 * Reads .audit/schema/*.csv and .audit/code/*.csv and produces a single
 * JSON findings file at .audit/reports/findings.json that the canvas
 * generator consumes.
 *
 * Each finding has:
 *   severity   BLOCKER | HIGH | MEDIUM | LOW | INFO
 *   category   string  (group/heading)
 *   title      short headline
 *   detail     long-form explanation
 *   sites      [{ file, line }]   evidence
 *   suggest    optional suggested fix
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const ALLOW_NON_PUBLIC_SCHEMAS = new Set([
  'auth',
  'storage',
  'realtime',
  'pgsodium',
  'graphql',
  'graphql_public',
  'vault',
  'extensions',
]);

// ---------------------------------------------------------------------------
// CSV reader (handles quoted fields and embedded commas)
// ---------------------------------------------------------------------------
function readCsv(file) {
  const txt = readFileSync(file, 'utf8');
  const lines = txt.split('\n').filter(Boolean);
  const header = parseRow(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseRow(lines[i]);
    if (!cols) continue;
    const row = {};
    for (let j = 0; j < header.length; j++) row[header[j]] = cols[j] ?? '';
    rows.push(row);
  }
  return rows;
}

function parseRow(line) {
  if (!line) return null;
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = false;
        }
      } else {
        cur += c;
      }
    } else {
      if (c === ',') {
        out.push(cur);
        cur = '';
      } else if (c === '"' && cur === '') {
        inQ = true;
      } else {
        cur += c;
      }
    }
  }
  out.push(cur);
  return out;
}

// ---------------------------------------------------------------------------
// Load schema + code inventories
// ---------------------------------------------------------------------------
const schemaTables = readCsv('.audit/schema/tables.csv'); // table_name,table_type,bytes,approx_rows
const schemaColumns = readCsv('.audit/schema/columns.csv'); // table_name,column_name,...
const schemaFunctions = readCsv('.audit/schema/functions.csv'); // function_name,arguments,returns,security,...
const schemaFKs = readCsv('.audit/schema/foreign_keys.csv'); // from_table,from_column,to_table,...
const schemaEnums = readCsv('.audit/schema/enums.csv'); // schema,enum_name,enumlabel,...
const schemaRlsPolicies = readCsv('.audit/schema/rls_policies.csv');
const schemaRlsEnabled = readCsv('.audit/schema/rls_enabled.csv'); // table_name,rls_enabled
const schemaViews = readCsv('.audit/schema/views.csv'); // schema,view_name,kind
const schemaIndexes = readCsv('.audit/schema/indexes.csv'); // schemaname,tablename,indexname,indexdef
const schemaTriggers = readCsv('.audit/schema/triggers.csv');
const schemaChecks = readCsv('.audit/schema/check_constraints.csv');

const codeTables = readCsv('.audit/code/tables.csv');
const codeColumns = readCsv('.audit/code/columns.csv');
const codeFilters = readCsv('.audit/code/filters.csv');
const codeInsertCols = readCsv('.audit/code/insert_cols.csv');
const codeRpcs = readCsv('.audit/code/rpcs.csv');
const codeJoins = readCsv('.audit/code/joins.csv');
const codeFindings = readCsv('.audit/code/findings.csv');

const dbTables = new Set(schemaTables.map((r) => r.table_name));
const dbViews = new Set(schemaViews.map((r) => r.view_name));
const dbRelations = new Set([...dbTables, ...dbViews]);
const dbFunctions = new Map();
for (const f of schemaFunctions) {
  if (!dbFunctions.has(f.function_name)) dbFunctions.set(f.function_name, []);
  dbFunctions.get(f.function_name).push(f);
}
const dbColumnsByTable = new Map();
for (const c of schemaColumns) {
  if (!dbColumnsByTable.has(c.table_name)) dbColumnsByTable.set(c.table_name, new Map());
  dbColumnsByTable.get(c.table_name).set(c.column_name, c);
}
const rlsEnabledByTable = new Map(schemaRlsEnabled.map((r) => [r.table_name, r.rls_enabled === 't']));
const policiesByTable = new Map();
for (const p of schemaRlsPolicies) {
  if (!policiesByTable.has(p.tablename)) policiesByTable.set(p.tablename, []);
  policiesByTable.get(p.tablename).push(p);
}
const fkBySource = new Map();
for (const fk of schemaFKs) {
  const key = `${fk.from_table}.${fk.from_column}`;
  if (!fkBySource.has(key)) fkBySource.set(key, []);
  fkBySource.get(key).push(fk);
}
const fkBetween = new Map(); // `${from}->${to}` => count
for (const fk of schemaFKs) {
  const k = `${fk.from_table}->${fk.to_table}`;
  fkBetween.set(k, (fkBetween.get(k) || 0) + 1);
  // reverse direction is also a valid PostgREST relationship hint
  const k2 = `${fk.to_table}->${fk.from_table}`;
  fkBetween.set(k2, (fkBetween.get(k2) || 0) + 1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const findings = [];
function record(f) {
  findings.push(f);
}

function uniqSites(list, limit = 8) {
  const seen = new Set();
  const out = [];
  for (const s of list) {
    const k = `${s.file}:${s.line}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

function isLikelyDbTable(name) {
  if (!name) return false;
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) return false;
  return true;
}

/**
 * Tables that live in non-public Supabase schemas and are accessed via
 * `db: { schema: '<schema>' }` on the client. False-positive sources for
 * "missing table" findings.
 */
const NON_PUBLIC_TABLES = new Set([
  // auth.*
  'users',
  'identities',
  'sessions',
  'refresh_tokens',
  'audit_log_entries',
  'instances',
  'mfa_factors',
  'mfa_challenges',
  'mfa_amr_claims',
  'one_time_tokens',
  'sso_providers',
  'sso_domains',
  'saml_providers',
  'saml_relay_states',
  'flow_state',
  // storage.*
  'objects',
  'buckets',
  's3_multipart_uploads',
  's3_multipart_uploads_parts',
  'migrations',
  // realtime.*
  'subscription',
  'messages',
  // pg_*
  'tables',
  'columns',
  // common third-party tables exposed via PostgREST in some projects
  'cron_jobs',
]);

// ---------------------------------------------------------------------------
// 1) Tables referenced in code that don't exist in DB
// ---------------------------------------------------------------------------
const tableRefs = new Map(); // table -> [{file,line}]
for (const r of codeTables) {
  if (r.kind !== 'literal') continue;
  if (!isLikelyDbTable(r.table)) continue;
  if (!tableRefs.has(r.table)) tableRefs.set(r.table, []);
  tableRefs.get(r.table).push({ file: r.file, line: Number(r.line) });
}
for (const [table, sites] of tableRefs) {
  if (dbRelations.has(table)) continue;
  // Skip well-known auth/storage tables — those are reached via
  // `db: { schema: 'auth' }` on the service-role client.
  if (NON_PUBLIC_TABLES.has(table)) continue;
  // Kebab-case names are almost always storage bucket IDs.
  const severity = table.includes('-') ? 'MEDIUM' : 'BLOCKER';
  record({
    severity,
    category: 'Missing tables',
    title: `Code references table \`${table}\` that does not exist in DB`,
    detail:
      `${sites.length} call site(s) use \`supabase.from('${table}')\` but PIFH has no public table or view by that name. ` +
      `Either the table was renamed/dropped, the code is dead, or this is a Storage bucket name (in which case the API should be \`supabase.storage.from('${table}')\`).`,
    sites: uniqSites(sites),
  });
}

// ---------------------------------------------------------------------------
// 2) RPCs called in code that don't exist in DB
// ---------------------------------------------------------------------------
const rpcRefs = new Map();
for (const r of codeRpcs) {
  if (!rpcRefs.has(r.fn)) rpcRefs.set(r.fn, []);
  rpcRefs.get(r.fn).push({ file: r.file, line: Number(r.line) });
}
for (const [fn, sites] of rpcRefs) {
  if (dbFunctions.has(fn)) continue;
  record({
    severity: 'BLOCKER',
    category: 'Missing RPCs',
    title: `Code calls RPC \`${fn}\` that does not exist in DB`,
    detail: `${sites.length} call site(s) invoke \`supabase.rpc('${fn}', …)\` but there is no \`public.${fn}\` function on PIFH. Calls will fail with \`PGRST202\` (function not found in schema cache).`,
    sites: uniqSites(sites),
    suggest: `Create the missing function via migration, or remove the code path.`,
  });
}

// ---------------------------------------------------------------------------
// 3) Columns referenced in code that don't exist on the referenced table
// ---------------------------------------------------------------------------
// Build a map of (table -> {column -> sites})
const colRefByTable = new Map();
function noteColRef(table, column, op, file, line) {
  if (!table || !column) return;
  if (!isLikelyDbTable(table)) return;
  if (!/^[A-Za-z_][\w]*$/.test(column)) return;
  // Skip references for tables we already know are missing (covered above).
  if (!dbRelations.has(table)) return;
  if (!colRefByTable.has(table)) colRefByTable.set(table, new Map());
  const cols = colRefByTable.get(table);
  if (!cols.has(column)) cols.set(column, []);
  cols.get(column).push({ file, line, op });
}
for (const r of codeColumns) noteColRef(r.table, r.column, r.op, r.file, Number(r.line));
for (const r of codeFilters) noteColRef(r.table, r.column, r.op, r.file, Number(r.line));
for (const r of codeInsertCols) noteColRef(r.table, r.column, r.op, r.file, Number(r.line));

for (const [table, cols] of colRefByTable) {
  const dbCols = dbColumnsByTable.get(table) || new Map();
  for (const [col, sites] of cols) {
    if (dbCols.has(col)) continue;
    // Special PostgREST aliases that aren't real columns
    if (col === 'count' || col === '*' || col === 'id') continue;
    // Filter out very-common false positives produced by aliased select like `name:full_name`
    // We catch them at parse time but the column we record is `full_name`. Still flag.
    const opsHit = new Set(sites.map((s) => s.op));
    const isWriteOp = [...opsHit].some((o) => ['insert', 'update', 'upsert', 'match'].includes(o));
    record({
      severity: isWriteOp ? 'BLOCKER' : 'HIGH',
      category: 'Unknown columns',
      title: `\`${table}.${col}\` referenced in code but column does not exist`,
      detail:
        `${sites.length} site(s) reference column \`${col}\` on table \`${table}\` (operations: ${[...opsHit].join(', ')}). ` +
        `PIFH has no such column. ${isWriteOp ? 'Writes will fail with PGRST204.' : 'Reads will return null silently or PGRST204.'}`,
      sites: uniqSites(sites),
    });
  }
}

// ---------------------------------------------------------------------------
// 4) Joins in code that have no matching FK
// ---------------------------------------------------------------------------
const joinCheck = new Map();
for (const j of codeJoins) {
  if (!isLikelyDbTable(j.parent_table) || !isLikelyDbTable(j.relation)) continue;
  const key = `${j.parent_table}->${j.relation}`;
  if (!joinCheck.has(key)) joinCheck.set(key, []);
  joinCheck.get(key).push({ file: j.file, line: Number(j.line), hint: j.hint, alias: j.alias });
}
for (const [key, sites] of joinCheck) {
  const [parent, rel] = key.split('->');
  if (!dbRelations.has(parent) || !dbRelations.has(rel)) continue;
  // Direct FK either direction OR same-name column (e.g. `relation` is a column name not a table)
  const hasFk = fkBetween.has(key);
  if (hasFk) continue;
  // PostgREST also supports views/computed relationships; treat as MEDIUM since
  // we can't fully verify these without a runtime probe.
  record({
    severity: 'MEDIUM',
    category: 'Unverified joins',
    title: `Embed \`${rel}\` from \`${parent}\` has no direct foreign key`,
    detail: `${sites.length} site(s) use PostgREST embed syntax \`${rel}(…)\` from table \`${parent}\` but there is no FK linking them in either direction. PostgREST may still resolve this via a many-to-many junction or a view, but the relationship is fragile and prone to "could not embed" errors.`,
    sites: uniqSites(sites),
  });
}

// ---------------------------------------------------------------------------
// 5) Tables with RLS disabled
// ---------------------------------------------------------------------------
const rlsDisabled = [];
for (const r of schemaRlsEnabled) {
  // Skip housekeeping / shadow tables.
  if (r.table_name.startsWith('_')) continue;
  if (r.rls_enabled !== 't') rlsDisabled.push(r.table_name);
}
if (rlsDisabled.length) {
  record({
    severity: 'HIGH',
    category: 'RLS disabled',
    title: `${rlsDisabled.length} public table(s) have RLS disabled`,
    detail:
      `These tables are exposed to anon/authenticated PostgREST callers without row-level security. ` +
      `Either RLS was deliberately turned off (in which case access must be enforced elsewhere) or this is a hole.\n\n` +
      `Tables: ${rlsDisabled.slice(0, 60).join(', ')}${rlsDisabled.length > 60 ? `, …+${rlsDisabled.length - 60} more` : ''}`,
    sites: [],
  });
}

// ---------------------------------------------------------------------------
// 6) Tables with RLS enabled but no policies
// ---------------------------------------------------------------------------
const rlsNoPolicies = [];
for (const r of schemaRlsEnabled) {
  if (r.rls_enabled !== 't') continue;
  if (r.table_name.startsWith('_')) continue;
  const pols = policiesByTable.get(r.table_name) || [];
  if (pols.length === 0) rlsNoPolicies.push(r.table_name);
}
if (rlsNoPolicies.length) {
  record({
    severity: 'MEDIUM',
    category: 'RLS misconfig',
    title: `${rlsNoPolicies.length} table(s) have RLS enabled but no policies`,
    detail:
      `These tables block ALL access for anon/authenticated roles by default — any client code reading them through PostgREST will silently return empty arrays.\n\n` +
      `Tables: ${rlsNoPolicies.slice(0, 60).join(', ')}${rlsNoPolicies.length > 60 ? `, …+${rlsNoPolicies.length - 60} more` : ''}`,
    sites: [],
    suggest: 'Add an appropriate SELECT policy or use a SECURITY DEFINER RPC.',
  });
}

// ---------------------------------------------------------------------------
// 7) Permissive policies that fully open a table (USING (true))
// ---------------------------------------------------------------------------
const wideOpenPolicies = schemaRlsPolicies.filter((p) => {
  const q = (p.qual || '').replace(/\s+/g, '').toLowerCase();
  const w = (p.with_check || '').replace(/\s+/g, '').toLowerCase();
  const wideQual = q === 'true' || q === '(true)';
  const wideCheck = w === 'true' || w === '(true)';
  if (!wideQual && !wideCheck) return false;
  // Limit to roles that include anon/authenticated/public
  const roles = (p.roles || '').toLowerCase();
  return /anon|authenticated|public/.test(roles);
});
if (wideOpenPolicies.length) {
  record({
    severity: 'HIGH',
    category: 'RLS too permissive',
    title: `${wideOpenPolicies.length} policy(ies) use \`USING (true)\` for anon/authenticated`,
    detail:
      `These policies grant unrestricted row access. Each one effectively disables RLS for the role it targets. ` +
      `Review and tighten with an org/user filter.\n\n` +
      wideOpenPolicies
        .slice(0, 40)
        .map((p) => `${p.tablename} :: ${p.policyname} (${p.cmd}, ${p.roles})`)
        .join('\n'),
    sites: [],
  });
}

// ---------------------------------------------------------------------------
// 8) Service role / dangerous client patterns
// ---------------------------------------------------------------------------
const serviceRoleInClient = codeFindings.filter((f) => f.kind === 'service-role-in-client');
if (serviceRoleInClient.length) {
  record({
    severity: 'BLOCKER',
    category: 'Service role on client',
    title: `${serviceRoleInClient.length} client/.tsx file(s) reference SERVICE_ROLE_KEY`,
    detail:
      `The service-role key bypasses RLS and must never be shipped to the browser. Any client component that imports or references it is a critical security bug.`,
    sites: uniqSites(serviceRoleInClient.map((r) => ({ file: r.file, line: Number(r.line) }))),
  });
}

// ---------------------------------------------------------------------------
// 9) Dynamic .from() calls
// ---------------------------------------------------------------------------
const dynamicFrom = codeFindings.filter((f) => f.kind === 'dynamic-from');
if (dynamicFrom.length) {
  record({
    severity: 'LOW',
    category: 'Dynamic table refs',
    title: `${dynamicFrom.length} \`.from(...)\` calls use a variable, not a string literal`,
    detail:
      `Dynamic table names can't be statically audited. Confirm each expression is constrained to a known whitelist; otherwise typos slip through to runtime.`,
    sites: uniqSites(
      dynamicFrom.map((r) => ({ file: r.file, line: Number(r.line) })),
      30,
    ),
  });
}

// ---------------------------------------------------------------------------
// 10) Dynamic select / insert / update / filter columns
// ---------------------------------------------------------------------------
const dynBuckets = new Map();
for (const f of codeFindings) {
  if (!f.kind.startsWith('dynamic-')) continue;
  if (f.kind === 'dynamic-from') continue;
  if (!dynBuckets.has(f.kind)) dynBuckets.set(f.kind, []);
  dynBuckets.get(f.kind).push({ file: f.file, line: Number(f.line) });
}
for (const [kind, sites] of dynBuckets) {
  if (sites.length < 5) continue;
  record({
    severity: 'LOW',
    category: 'Dynamic chain calls',
    title: `${sites.length} dynamic ${kind.replace('dynamic-', '')} expressions in code`,
    detail:
      `These chain operations passed a variable instead of a string literal, so the auditor couldn't statically resolve the column or value names. Spot-check the ones flagged.`,
    sites: uniqSites(sites, 12),
  });
}

// ---------------------------------------------------------------------------
// 11) Tables in DB never referenced anywhere in code
// ---------------------------------------------------------------------------
const referencedTables = new Set();
for (const r of codeTables) if (r.kind === 'literal') referencedTables.add(r.table);
// Also pull from filters/columns/inserts in case .from() was assigned to a var.
for (const r of codeColumns) referencedTables.add(r.table);
for (const r of codeFilters) referencedTables.add(r.table);
for (const r of codeInsertCols) referencedTables.add(r.table);

const orphanTables = [];
for (const t of dbTables) {
  if (referencedTables.has(t)) continue;
  // Skip Supabase internal / migration housekeeping
  if (
    t.startsWith('_') ||
    t.startsWith('z_') ||
    t === 'schema_migrations' ||
    t === 'pg_stat_statements' ||
    t === 'spatial_ref_sys'
  ) {
    continue;
  }
  // Skip the migrate_*/contact_field tables that look intentional housekeeping
  orphanTables.push(t);
}
if (orphanTables.length) {
  record({
    severity: 'LOW',
    category: 'Possibly unused tables',
    title: `${orphanTables.length} public table(s) are never referenced in the frontend code`,
    detail:
      `Could be: (a) consumed only by Edge Functions / triggers / other services, (b) legacy. Review before assuming dead.\n\n` +
      `Tables: ${orphanTables.slice(0, 60).join(', ')}${orphanTables.length > 60 ? `, …+${orphanTables.length - 60} more` : ''}`,
    sites: [],
  });
}

// ---------------------------------------------------------------------------
// 12) RPCs in DB never called from code
// ---------------------------------------------------------------------------
const referencedRpcs = new Set(codeRpcs.map((r) => r.fn));
const orphanRpcs = [];
for (const [name] of dbFunctions) {
  // Skip trigger functions, helper internals (heuristic: many of these are private)
  if (name.startsWith('_')) continue;
  if (name.endsWith('_trigger')) continue;
  if (name.startsWith('pg_') || name.startsWith('handle_')) continue;
  if (referencedRpcs.has(name)) continue;
  orphanRpcs.push(name);
}
if (orphanRpcs.length) {
  record({
    severity: 'INFO',
    category: 'Unused RPCs',
    title: `${orphanRpcs.length} public function(s) are not called via .rpc() in the frontend`,
    detail:
      `Many are likely trigger functions or DB-internal helpers and that's fine. Spot-check anything you thought was wired up.\n\n` +
      `Functions: ${orphanRpcs.slice(0, 60).join(', ')}${orphanRpcs.length > 60 ? `, …+${orphanRpcs.length - 60} more` : ''}`,
    sites: [],
  });
}

// ---------------------------------------------------------------------------
// 13) Foreign keys that allow CASCADE delete on org-pivot columns
//     (catches accidental tenant-wide wipes)
// ---------------------------------------------------------------------------
const cascadeOrgFks = schemaFKs.filter(
  (fk) =>
    fk.delete_rule === 'CASCADE' &&
    /organization_id|org_id/i.test(fk.from_column) &&
    fk.to_table === 'organizations',
);
if (cascadeOrgFks.length) {
  record({
    severity: 'MEDIUM',
    category: 'Risky cascades',
    title: `${cascadeOrgFks.length} FK(s) cascade-delete from \`organizations\``,
    detail:
      `Removing an org row will cascade and wipe these tables for that tenant. Confirm this is intentional.\n\n` +
      cascadeOrgFks
        .slice(0, 40)
        .map((fk) => `${fk.from_table}.${fk.from_column}`)
        .join('\n'),
    sites: [],
  });
}

// ---------------------------------------------------------------------------
// 14) Missing indexes on commonly filtered columns
// ---------------------------------------------------------------------------
// Build set of (table, column) pairs we have an index on.
const indexedPairs = new Set();
for (const idx of schemaIndexes) {
  // Pull column names out of `(col, col2)` in indexdef
  const m = idx.indexdef.match(/\(([^)]+)\)/);
  if (!m) continue;
  const cols = m[1].split(',').map((s) => s.trim().split(' ')[0].replace(/"/g, ''));
  for (const c of cols) indexedPairs.add(`${idx.tablename}.${c}`);
}
const filterFrequency = new Map();
for (const r of codeFilters) {
  if (!isLikelyDbTable(r.table) || !/^[A-Za-z_]\w*$/.test(r.column)) continue;
  if (!dbRelations.has(r.table)) continue;
  const dbCols = dbColumnsByTable.get(r.table);
  if (!dbCols || !dbCols.has(r.column)) continue;
  const key = `${r.table}.${r.column}`;
  filterFrequency.set(key, (filterFrequency.get(key) || 0) + 1);
}
const missingIndexes = [];
for (const [key, count] of filterFrequency) {
  if (count < 5) continue;
  if (indexedPairs.has(key)) continue;
  const [table, col] = key.split('.');
  // PK 'id' columns are implicitly indexed; ignore
  if (col === 'id') continue;
  // Common columns we filter on but PG auto-indexes for FKs sometimes; only
  // warn when a sizable table is involved.
  const tableMeta = schemaTables.find((t) => t.table_name === table);
  const rows = tableMeta ? Number(tableMeta.approx_rows) : 0;
  if (rows < 1000) continue;
  missingIndexes.push({ key, count, rows });
}
if (missingIndexes.length) {
  missingIndexes.sort((a, b) => b.rows * b.count - a.rows * a.count);
  record({
    severity: 'MEDIUM',
    category: 'Missing indexes',
    title: `${missingIndexes.length} hot filter column(s) have no index`,
    detail:
      `Frontend code filters on these columns 5+ times and the table has 1k+ rows, but PIFH has no covering index. Each call triggers a seq scan.\n\n` +
      missingIndexes
        .slice(0, 30)
        .map((m) => `${m.key}  (${m.count} call sites, ~${m.rows.toLocaleString()} rows)`)
        .join('\n'),
    sites: [],
  });
}

// ---------------------------------------------------------------------------
// 15) Migrations declared in repo but not applied on PIFH (drift)
// ---------------------------------------------------------------------------
const localMigrations = new Set(
  readdirSync('supabase/migrations')
    .filter((f) => f.endsWith('.sql'))
    .map((f) => f.split('_')[0]),
);
const appliedMigrations = new Set(
  readFileSync('.audit/schema/applied_migrations.csv', 'utf8').split('\n').filter(Boolean),
);
const localOnly = [...localMigrations].filter((v) => !appliedMigrations.has(v));
const remoteOnly = [...appliedMigrations].filter((v) => !localMigrations.has(v));
if (localOnly.length) {
  record({
    severity: 'HIGH',
    category: 'Migration drift',
    title: `${localOnly.length} migration file(s) in repo are not applied on PIFH`,
    detail: `These local-only versions need to be pushed (or removed if intentional): ${localOnly.slice(0, 30).join(', ')}${localOnly.length > 30 ? `, …` : ''}`,
    sites: [],
  });
}
if (remoteOnly.length) {
  record({
    severity: 'MEDIUM',
    category: 'Migration drift',
    title: `${remoteOnly.length} migration version(s) exist on PIFH but not in repo`,
    detail:
      `Likely caused by squash, ad-hoc dashboard edits, or someone deleting local files. Numbers: ${remoteOnly.slice(0, 30).join(', ')}${remoteOnly.length > 30 ? `, …` : ''}`,
    sites: [],
  });
}

// ---------------------------------------------------------------------------
// 16) Duplicate migration prefixes (collision risk)
// ---------------------------------------------------------------------------
const prefixCount = new Map();
for (const f of readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql'))) {
  const prefix = f.split('_')[0];
  if (!prefixCount.has(prefix)) prefixCount.set(prefix, []);
  prefixCount.get(prefix).push(f);
}
const collisions = [...prefixCount.entries()].filter(([, list]) => list.length > 1);
if (collisions.length) {
  record({
    severity: 'HIGH',
    category: 'Migration drift',
    title: `${collisions.length} duplicate migration timestamp prefix(es)`,
    detail:
      `When two files share the same 12-digit prefix, Supabase's tracker only records the first one. Subsequent files silently fail to push.\n\n` +
      collisions
        .slice(0, 20)
        .map(([p, list]) => `${p}: ${list.join('  +  ')}`)
        .join('\n'),
    sites: [],
  });
}

// ---------------------------------------------------------------------------
// Write findings
// ---------------------------------------------------------------------------
const summary = {
  scan: {
    schema: {
      tables: dbTables.size,
      columns: schemaColumns.length,
      functions: dbFunctions.size,
      foreignKeys: schemaFKs.length,
      enums: new Set(schemaEnums.map((r) => r.enum_name)).size,
      rlsPolicies: schemaRlsPolicies.length,
      indexes: schemaIndexes.length,
      triggers: schemaTriggers.length,
      views: schemaViews.length,
    },
    code: {
      filesScanned: 1773,
      filesWithSupabase: 809,
      fromCalls: codeTables.filter((r) => r.kind === 'literal').length,
      uniqueTablesRef: tableRefs.size,
      rpcCalls: codeRpcs.length,
      uniqueRpcsRef: rpcRefs.size,
      joins: codeJoins.length,
      dynamicRefs: codeFindings.length,
    },
  },
  bySeverity: findings.reduce((acc, f) => {
    acc[f.severity] = (acc[f.severity] || 0) + 1;
    return acc;
  }, {}),
  findings,
};

writeFileSync('.audit/reports/findings.json', JSON.stringify(summary, null, 2));
console.log(`Wrote ${findings.length} findings to .audit/reports/findings.json`);
console.log(`Severity breakdown:`);
for (const [s, n] of Object.entries(summary.bySeverity)) console.log(`  ${s}: ${n}`);
