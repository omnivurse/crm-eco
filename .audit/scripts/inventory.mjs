#!/usr/bin/env node
/**
 * Hawkeye frontend inventory.
 *
 * Walks the monorepo's TS/TSX/JS files and extracts every Supabase call so
 * we can cross-reference against the live PIFH schema dump.
 *
 * Outputs (all CSV under .audit/code/):
 *   tables.csv          file, line, table, op            (from, rpc, raw_sql)
 *   columns.csv         file, line, table, op, column
 *   rpcs.csv            file, line, fn_name
 *   joins.csv           file, line, table, relation_name, target_hint
 *   raw_sql.csv         file, line, snippet
 *   service_role.csv    file, line, kind                 (service-role / SERVICE_ROLE_KEY)
 *   findings.csv        miscellaneous per-file hits
 *
 * Why regex and not the TS AST? Because (a) the AST adds 30s+ of overhead
 * before producing anything and (b) the actual Supabase client patterns are
 * dead-stable: chains of `.from('x').select('a,b').eq('c', v)`. Regex
 * captures > 95% of real usage; the remaining dynamic cases are flagged
 * in `findings.csv` as "dynamic" so a human can sanity check them.
 */

import { readFileSync, writeFileSync, statSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = ['apps', 'packages'];
const EXTS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs']);
const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  'dist',
  'build',
  'out',
  'coverage',
  '.turbo',
  '.vercel',
  'public',
]);

// ---------------------------------------------------------------------------
// File walker
// ---------------------------------------------------------------------------
function walk(dir, files = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, files);
    } else if (entry.isFile()) {
      const dot = entry.name.lastIndexOf('.');
      if (dot < 0) continue;
      const ext = entry.name.slice(dot);
      if (!EXTS.has(ext)) continue;
      files.push(full);
    }
  }
  return files;
}

// ---------------------------------------------------------------------------
// Pattern extractors
// ---------------------------------------------------------------------------

/** Count lines preceding offset `idx`. 1-indexed. */
function lineNumberAt(src, idx) {
  let n = 1;
  for (let i = 0; i < idx; i++) if (src.charCodeAt(i) === 10) n++;
  return n;
}

/**
 * Replace JS line/block comments with spaces (preserves byte offsets so line
 * numbers stay accurate). Strings (single, double, template, regex) are left
 * intact, so a literal "// not a comment" inside a string survives.
 */
function stripComments(src) {
  const out = Array.from(src);
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    // Skip strings — single, double, template
    if (c === "'" || c === '"') {
      const quote = c;
      i++;
      while (i < n) {
        if (out[i] === '\\') {
          i += 2;
          continue;
        }
        if (out[i] === quote) {
          i++;
          break;
        }
        if (out[i] === '\n') break;
        i++;
      }
      continue;
    }
    if (c === '`') {
      i++;
      while (i < n) {
        if (out[i] === '\\') {
          i += 2;
          continue;
        }
        if (out[i] === '`') {
          i++;
          break;
        }
        // Template interpolation — skip the ${ ... } block conservatively
        if (out[i] === '$' && out[i + 1] === '{') {
          let depth = 1;
          i += 2;
          while (i < n && depth > 0) {
            if (out[i] === '{') depth++;
            else if (out[i] === '}') depth--;
            i++;
          }
          continue;
        }
        i++;
      }
      continue;
    }
    if (c === '/' && out[i + 1] === '/') {
      // Line comment — blank to EOL.
      while (i < n && out[i] !== '\n') {
        out[i] = ' ';
        i++;
      }
      continue;
    }
    if (c === '/' && out[i + 1] === '*') {
      // Block comment — blank, preserve newlines.
      out[i] = ' ';
      out[i + 1] = ' ';
      i += 2;
      while (i < n) {
        if (out[i] === '*' && out[i + 1] === '/') {
          out[i] = ' ';
          out[i + 1] = ' ';
          i += 2;
          break;
        }
        if (out[i] !== '\n') out[i] = ' ';
        i++;
      }
      continue;
    }
    i++;
  }
  return out.join('');
}

function csvEscape(v) {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/**
 * Find `.from('x')` and `.from("x")` and `.from(\`x\`)` calls.
 * Returns array of { table, idx }.
 */
function extractFrom(src) {
  const out = [];
  const re = /\.from\(\s*(['"`])([^'"`\n)]+)\1\s*\)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    out.push({ table: m[2].trim(), idx: m.index });
  }
  // Flag the dynamic ones (variable-driven .from) separately.
  const dyn = [];
  const re2 = /\.from\(\s*([^'"`)\s][^)]*)\)/g;
  while ((m = re2.exec(src)) !== null) {
    const arg = m[1];
    // Skip if this matched a literal call we already saw at a nearby spot.
    if (/^['"`]/.test(arg.trim())) continue;
    dyn.push({ expr: arg.trim().slice(0, 80), idx: m.index });
  }
  return { literal: out, dynamic: dyn };
}

function extractRpc(src) {
  const out = [];
  const re = /\.rpc\(\s*(['"`])([^'"`\n)]+)\1/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    out.push({ fn: m[2].trim(), idx: m.index });
  }
  return out;
}

/**
 * Given a substring starting at "(<select arg>)" capture the contents inside
 * the first balanced parens. Returns null if not balanced.
 */
function readBalancedArg(src, startIdx) {
  // startIdx must be at '('
  if (src[startIdx] !== '(') return null;
  let depth = 0;
  let inStr = null;
  for (let i = startIdx; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (c === '\\') {
        i++;
        continue;
      }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      inStr = c;
      continue;
    }
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return { arg: src.slice(startIdx + 1, i), end: i };
    }
  }
  return null;
}

/**
 * Walk forward from a `.from('table')` literal and pull every chained
 * `.select / .insert / .update / .upsert / .delete / .eq / .neq / .in /
 *  .gt / .gte / .lt / .lte / .like / .ilike / .is / .not / .or / .filter /
 *  .order / .range / .single / .maybeSingle` call until the chain breaks.
 *
 * Returns an array of { op, arg, idx }.
 */
const CHAIN_OPS = new Set([
  'select',
  'insert',
  'update',
  'upsert',
  'delete',
  'eq',
  'neq',
  'in',
  'gt',
  'gte',
  'lt',
  'lte',
  'like',
  'ilike',
  'is',
  'not',
  'or',
  'and',
  'filter',
  'match',
  'order',
  'range',
  'limit',
  'single',
  'maybeSingle',
  'overlaps',
  'contains',
  'containedBy',
  'rangeGt',
  'rangeGte',
  'rangeLt',
  'rangeLte',
  'rangeAdjacent',
  'textSearch',
  'returns',
  'select',
  'csv',
]);

function extractChain(src, fromCallEnd) {
  const calls = [];
  let i = fromCallEnd;
  // Skip whitespace and dots
  while (i < src.length) {
    while (i < src.length && /\s/.test(src[i])) i++;
    if (src[i] !== '.') break;
    i++;
    // Read identifier
    const startId = i;
    while (i < src.length && /[A-Za-z_$0-9]/.test(src[i])) i++;
    const ident = src.slice(startId, i);
    if (!CHAIN_OPS.has(ident)) break;
    // Expect '('
    while (i < src.length && /\s/.test(src[i])) i++;
    if (src[i] !== '(') {
      calls.push({ op: ident, arg: '', idx: startId });
      continue;
    }
    const balanced = readBalancedArg(src, i);
    if (!balanced) break;
    calls.push({ op: ident, arg: balanced.arg.trim(), idx: startId });
    i = balanced.end + 1;
  }
  return calls;
}

/**
 * Parse the argument of `.select('a, b, related:other(*), c')` into:
 *   { columns: ['a','b','c'], joins: [{ relation:'related', target:'other' }] }
 *
 * Strips comments and handles nested join parens.
 */
function parseSelectArg(arg) {
  // arg is the raw inner expression. Only meaningful when it's a string lit.
  const m = arg.match(/^\s*(['"`])([\s\S]*?)\1/);
  if (!m) return { columns: [], joins: [], dynamic: true };
  const raw = m[2];

  const columns = [];
  const joins = [];
  let buf = '';
  let depth = 0;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '(') {
      depth++;
      buf += c;
      continue;
    }
    if (c === ')') {
      depth--;
      buf += c;
      continue;
    }
    if (c === ',' && depth === 0) {
      pushPart(buf, columns, joins);
      buf = '';
      continue;
    }
    buf += c;
  }
  if (buf.trim()) pushPart(buf, columns, joins);

  return { columns, joins, dynamic: false };
}

function pushPart(piece, columns, joins) {
  const p = piece.trim();
  if (!p || p === '*' || p === 'count') return;
  // Forms we care about:
  //   col
  //   alias:col
  //   relation(cols)
  //   alias:relation(cols)
  //   relation!fk_name(cols)
  //   relation!inner(cols)
  //   alias:relation!fk_name(cols)
  const joinMatch = p.match(/^([A-Za-z_][\w]*\s*:\s*)?([A-Za-z_][\w]*)(?:!([A-Za-z_][\w]*))?\s*\(([\s\S]*)\)\s*$/);
  if (joinMatch) {
    const alias = joinMatch[1] ? joinMatch[1].replace(/[: \t]/g, '') : null;
    const relation = joinMatch[2];
    const hint = joinMatch[3] || null;
    joins.push({ alias, relation, hint });
    // Recursively parse nested select cols against the joined relation.
    const nestedColumns = [];
    const nestedJoins = [];
    let nbuf = '';
    let depth = 0;
    const inner = joinMatch[4];
    for (let i = 0; i < inner.length; i++) {
      const c = inner[i];
      if (c === '(') depth++;
      if (c === ')') depth--;
      if (c === ',' && depth === 0) {
        pushPart(nbuf, nestedColumns, nestedJoins);
        nbuf = '';
        continue;
      }
      nbuf += c;
    }
    if (nbuf.trim()) pushPart(nbuf, nestedColumns, nestedJoins);
    for (const col of nestedColumns) {
      columns.push({ table: relation, column: col });
    }
    for (const nj of nestedJoins) {
      joins.push({ ...nj, parent: relation });
    }
    return;
  }
  // alias:col
  const aliasMatch = p.match(/^([A-Za-z_][\w]*)\s*:\s*([A-Za-z_][\w.]+)$/);
  if (aliasMatch) {
    columns.push(aliasMatch[2].split('.').pop());
    return;
  }
  // Plain column. Strip ::cast.
  const clean = p.replace(/::[A-Za-z_][\w]*/g, '').trim();
  if (/^[A-Za-z_][\w]*$/.test(clean)) columns.push(clean);
  else columns.push({ raw: clean });
}

/**
 * Parse `.eq('col', x)` etc. — extract the literal column name (first arg).
 */
function parseFilterCol(arg) {
  const m = arg.match(/^\s*(['"`])([^'"`,)]+)\1/);
  return m ? m[2] : null;
}

/**
 * Parse `.insert({ a: 1, b: 2 })` / .update({...}) / .upsert({...})
 * Returns an array of top-level object keys. Handles nested obj/arrays
 * conservatively (only top-level keys at depth 0).
 */
function parseObjectKeys(arg) {
  const trimmed = arg.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
  // Array of objects -> use first one
  let body = trimmed;
  if (trimmed.startsWith('[')) {
    const innerStart = trimmed.indexOf('{');
    const innerEnd = trimmed.lastIndexOf('}');
    if (innerStart < 0 || innerEnd < 0) return [];
    body = trimmed.slice(innerStart, innerEnd + 1);
  }
  if (!body.startsWith('{')) return [];
  // Extract keys at depth==1 (just inside the outer braces).
  // `expectingKey` is true ONLY at a key position: right after `{` or after
  // a `,` at depth 1. Without this we used to mistake the `:` of a ternary
  // for an object-literal `:`, which produced phantom column names like
  // `members.string` from `typeof x === 'string' ? ... : ...`.
  const keys = new Set();
  let depth = 0;
  let inStr = null;
  let i = 0;
  let expectingKey = false;
  let atKey = false;
  let pendingKey = '';
  while (i < body.length) {
    const c = body[i];
    if (inStr) {
      if (c === '\\') {
        i += 2;
        continue;
      }
      if (c === inStr) {
        inStr = null;
        i++;
        continue;
      }
      if (atKey && depth === 1) pendingKey += c;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      inStr = c;
      // Only treat this opening quote as a key when we're at a key position.
      if (depth === 1 && expectingKey) {
        atKey = true;
        pendingKey = '';
      }
      i++;
      continue;
    }
    if (c === '{' || c === '[' || c === '(') {
      depth++;
      atKey = false;
      // After opening the OUTER object (depth went 0 -> 1), the first
      // non-space token is a key. Nested {} aren't scanned for keys here.
      expectingKey = depth === 1;
      i++;
      continue;
    }
    if (c === '}' || c === ']' || c === ')') {
      depth--;
      atKey = false;
      // After closing back into depth 1, the comma logic below will set
      // expectingKey when we see a `,`.
      expectingKey = false;
      i++;
      continue;
    }
    if (depth === 1) {
      if (c === ':' && atKey) {
        if (pendingKey) keys.add(pendingKey);
        atKey = false;
        expectingKey = false;
        pendingKey = '';
        i++;
        continue;
      }
      if (c === ',') {
        atKey = false;
        pendingKey = '';
        expectingKey = true;
        i++;
        continue;
      }
      // unquoted key — only at a key position
      if (/[A-Za-z_$]/.test(c) && !atKey && expectingKey) {
        let j = i;
        while (j < body.length && /[A-Za-z_$0-9]/.test(body[j])) j++;
        // Look ahead for ':'
        let k = j;
        while (k < body.length && /\s/.test(body[k])) k++;
        if (body[k] === ':') {
          keys.add(body.slice(i, j));
          expectingKey = false;
          // Skip past
          i = k + 1;
          continue;
        }
      }
    }
    // Set expectingKey to true on entering the outer object body.
    if (c === '{' /* impossible here, handled above */) {
      // no-op, depth handler covers it
    }
    i++;
  }
  return [...keys];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const SUPABASE_HINT = /\.(from|rpc|select|insert|update|upsert|delete|eq|in|rpc)\s*\(/;

const tablesOut = []; // file, line, table, op, kind  (kind=literal|dynamic)
const columnsOut = []; // file, line, table, op, column
const rpcsOut = []; // file, line, fn
const joinsOut = []; // file, line, table, relation, alias, hint
const filtersOut = []; // file, line, table, op, column
const insertColsOut = []; // file, line, table, op, column
const findingsOut = []; // file, line, kind, detail
const rawSqlOut = []; // file, line, snippet

let filesScanned = 0;
let supabaseFiles = 0;

const allFiles = [];
for (const dir of SCAN_DIRS) {
  walk(join(ROOT, dir), allFiles);
}

for (const fpath of allFiles) {
  let rawSrc;
  try {
    rawSrc = readFileSync(fpath, 'utf8');
  } catch {
    continue;
  }
  filesScanned++;
  if (!SUPABASE_HINT.test(rawSrc) && !/supabase|createClient/.test(rawSrc)) continue;
  // Strip comments before extraction so JSDoc examples don't pollute findings.
  const src = stripComments(rawSrc);
  const rel = relative(ROOT, fpath);
  supabaseFiles++;

  // ---- .from(...) extraction with full chain walk ----
  const fromMatches = extractFrom(src);
  for (const { table, idx } of fromMatches.literal) {
    const line = lineNumberAt(src, idx);
    tablesOut.push([rel, line, table, 'from', 'literal']);

    // Walk the chain right after this .from(...) call ends.
    const callEnd = src.indexOf(')', idx);
    if (callEnd === -1) continue;
    const chain = extractChain(src, callEnd + 1);
    for (const c of chain) {
      const cLine = lineNumberAt(src, c.idx);
      if (c.op === 'select') {
        const { columns, joins, dynamic } = parseSelectArg(c.arg);
        if (dynamic) {
          findingsOut.push([rel, cLine, 'dynamic-select', c.arg.slice(0, 120)]);
        }
        for (const col of columns) {
          if (typeof col === 'string') {
            columnsOut.push([rel, cLine, table, 'select', col]);
          } else if (col && typeof col === 'object') {
            if (col.column) columnsOut.push([rel, cLine, col.table, 'select', col.column]);
            else if (col.raw) findingsOut.push([rel, cLine, 'select-expr', col.raw]);
          }
        }
        for (const j of joins) {
          joinsOut.push([rel, cLine, j.parent || table, j.relation, j.alias || '', j.hint || '']);
        }
      } else if (c.op === 'insert' || c.op === 'update' || c.op === 'upsert') {
        const keys = parseObjectKeys(c.arg);
        if (keys === null) {
          findingsOut.push([rel, cLine, `dynamic-${c.op}`, c.arg.slice(0, 120)]);
        } else {
          // Drop Supabase option-object keys — these are NOT column names.
          // For upsert: `{ onConflict, ignoreDuplicates, count, defaultToNull }`
          // For insert/update: `{ count, returning }`
          const SUPABASE_OPTION_KEYS = new Set([
            'onConflict',
            'ignoreDuplicates',
            'count',
            'returning',
            'defaultToNull',
          ]);
          for (const k of keys) {
            if (SUPABASE_OPTION_KEYS.has(k)) continue;
            insertColsOut.push([rel, cLine, table, c.op, k]);
          }
        }
      } else if (
        c.op === 'eq' ||
        c.op === 'neq' ||
        c.op === 'in' ||
        c.op === 'gt' ||
        c.op === 'gte' ||
        c.op === 'lt' ||
        c.op === 'lte' ||
        c.op === 'like' ||
        c.op === 'ilike' ||
        c.op === 'is' ||
        c.op === 'contains' ||
        c.op === 'containedBy' ||
        c.op === 'overlaps' ||
        c.op === 'filter' ||
        c.op === 'order' ||
        c.op === 'match'
      ) {
        if (c.op === 'match') {
          const keys = parseObjectKeys(c.arg) || [];
          for (const k of keys) filtersOut.push([rel, cLine, table, 'match', k]);
        } else {
          const col = parseFilterCol(c.arg);
          if (col) filtersOut.push([rel, cLine, table, c.op, col]);
          else findingsOut.push([rel, cLine, `dynamic-${c.op}`, c.arg.slice(0, 120)]);
        }
      }
    }
  }
  for (const { expr, idx } of fromMatches.dynamic) {
    const line = lineNumberAt(src, idx);
    tablesOut.push([rel, line, expr, 'from', 'dynamic']);
    findingsOut.push([rel, line, 'dynamic-from', expr]);
  }

  // ---- .rpc('fn') ----
  for (const { fn, idx } of extractRpc(src)) {
    rpcsOut.push([rel, lineNumberAt(src, idx), fn]);
  }

  // ---- service role / dangerous patterns ----
  if (/SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE|service_role/.test(src)) {
    // Only flag for client/components, not server-only paths.
    const isClient = /['"]use client['"]/.test(src) || /\.tsx$/.test(fpath);
    if (isClient) {
      findingsOut.push([rel, 1, 'service-role-in-client', 'file references SERVICE_ROLE']);
    }
  }

  // ---- raw SQL ($$ ... $$, supabase.sql``, etc.) ----
  const rawSqlPatterns = [
    /supabase\.(?:rpc\s*\(\s*['"`]exec_sql['"`])/g,
    /\bSQL\(\s*['"`]/g,
  ];
  for (const p of rawSqlPatterns) {
    let m;
    while ((m = p.exec(src)) !== null) {
      rawSqlOut.push([rel, lineNumberAt(src, m.index), m[0]]);
    }
  }
}

// ---------------------------------------------------------------------------
// CSV writers
// ---------------------------------------------------------------------------
function writeCsv(file, header, rows) {
  const out = [header.join(',')];
  for (const r of rows) out.push(r.map(csvEscape).join(','));
  writeFileSync(file, out.join('\n') + '\n');
}

writeCsv('.audit/code/tables.csv', ['file', 'line', 'table', 'op', 'kind'], tablesOut);
writeCsv('.audit/code/columns.csv', ['file', 'line', 'table', 'op', 'column'], columnsOut);
writeCsv('.audit/code/filters.csv', ['file', 'line', 'table', 'op', 'column'], filtersOut);
writeCsv('.audit/code/insert_cols.csv', ['file', 'line', 'table', 'op', 'column'], insertColsOut);
writeCsv('.audit/code/rpcs.csv', ['file', 'line', 'fn'], rpcsOut);
writeCsv('.audit/code/joins.csv', ['file', 'line', 'parent_table', 'relation', 'alias', 'hint'], joinsOut);
writeCsv('.audit/code/raw_sql.csv', ['file', 'line', 'snippet'], rawSqlOut);
writeCsv('.audit/code/findings.csv', ['file', 'line', 'kind', 'detail'], findingsOut);

console.error(
  `Scanned ${filesScanned} files; ${supabaseFiles} had Supabase calls.\n` +
    `  ${tablesOut.length} .from() calls\n` +
    `  ${columnsOut.length} column refs (select)\n` +
    `  ${filtersOut.length} column refs (filter)\n` +
    `  ${insertColsOut.length} column refs (insert/update)\n` +
    `  ${rpcsOut.length} .rpc() calls\n` +
    `  ${joinsOut.length} joins\n` +
    `  ${findingsOut.length} flagged dynamic / odd refs\n`,
);
