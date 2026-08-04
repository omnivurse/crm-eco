#!/usr/bin/env node
/**
 * Regenerate packages/lib/src/types/database.ts from the live Supabase schema.
 *
 * Replaces the previous one-liner:
 *
 *   supabase gen types typescript --project-id <ref> 2>/dev/null \
 *     | sed -n '1,/^} as const$/p' > packages/lib/src/types/database.ts \
 *     && echo "  ✓ wrote ..."
 *
 * which had three compounding defects that made a FAILED generation
 * indistinguishable from a good one:
 *
 *   1. `2>/dev/null` discarded the CLI's error message, so an auth failure or a
 *      network error was invisible.
 *   2. `>` truncated database.ts the instant the pipeline started — before the
 *      generator had produced a single byte. A failure therefore left an empty
 *      or half-written file.
 *   3. `&& echo "✓ wrote"` reported success based on `sed`'s exit code, which is
 *      0 even when its input was empty.
 *
 * The result was a file that silently drifted from the schema, and two commits
 * that hand-edited it instead (finalize_member_enrollment_tx was inserted out of
 * alphabetical order — something `supabase gen types` never emits).
 *
 * This script writes to a temp file, validates it against explicit floors, and
 * only then moves it into place. Any failure exits non-zero with the CLI's own
 * stderr intact and leaves the existing file untouched.
 *
 * Usage:
 *   node scripts/gen-db-types.mjs            # uses DEFAULT_PROJECT_ID
 *   SUPABASE_PROJECT_ID=abc node scripts/...  # override the target project
 *   node scripts/gen-db-types.mjs --check     # verify current file, generate nothing
 *
 * Requires a Supabase access token: `supabase login`, or SUPABASE_ACCESS_TOKEN.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = path.join(ROOT, 'packages/lib/src/types/database.ts');

/** Production project. Override with SUPABASE_PROJECT_ID. */
const DEFAULT_PROJECT_ID = 'sffisarikcreyyjzdjvb';

/**
 * Sanity floors. These are deliberately crude — their only job is to catch a
 * truncated, empty, or wrong-project result before it overwrites 45k lines of
 * working types. Raise MIN_LINES if the schema grows substantially.
 */
const MIN_LINES = 30_000;
const REQUIRED_SYMBOLS = [
  'crm_records:',
  'organization_members:',
  'members:',
  'enrollments:',
  'profiles:',
];

function fail(msg, detail) {
  console.error(`\n✗ ${msg}`);
  if (detail) console.error(String(detail).trimEnd());
  console.error('\nThe existing database.ts was NOT modified.\n');
  process.exit(1);
}

/**
 * Strip anything the CLI printed around the actual module. `supabase gen types`
 * can emit deprecation warnings, and the file must begin at the first real TS
 * statement and end at the final `} as const`.
 */
function extractModule(raw) {
  const lines = raw.split(/\r?\n/);

  const start = lines.findIndex((l) => /^\s*(export|import|type|\/\*\*|\/\/)/.test(l));
  if (start === -1) return null;

  let end = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^\}\s*as const$/.test(lines[i])) {
      end = i;
      break;
    }
  }
  // Older generator versions ended at the closing brace of the Database type
  // rather than a Constants block; fall back to the last non-empty line.
  if (end === -1) {
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim() !== '') {
        end = i;
        break;
      }
    }
  }
  if (end < start) return null;

  return lines.slice(start, end + 1).join('\n') + '\n';
}

function validate(content, label) {
  const lineCount = content.split('\n').length;
  if (lineCount < MIN_LINES) {
    fail(
      `${label}: only ${lineCount.toLocaleString()} lines (floor is ${MIN_LINES.toLocaleString()}).`,
      'This is what a silently-truncated generation looks like.',
    );
  }
  const missing = REQUIRED_SYMBOLS.filter((s) => !content.includes(s));
  if (missing.length) {
    fail(
      `${label}: missing expected table(s): ${missing.join(', ')}.`,
      'Either the generation is incomplete or it targeted the wrong project.',
    );
  }
  if (!/export type Database\b/.test(content)) {
    fail(`${label}: no \`export type Database\` found.`);
  }
  return lineCount;
}

// ── --check mode: validate what is already on disk, generate nothing ──────────
if (process.argv.includes('--check')) {
  if (!fs.existsSync(TARGET)) fail('database.ts does not exist.');
  const lines = validate(fs.readFileSync(TARGET, 'utf8'), 'database.ts');
  console.log(`✓ database.ts passes the floors (${lines.toLocaleString()} lines)`);
  process.exit(0);
}

// ── Generate ─────────────────────────────────────────────────────────────────
const projectId = process.env.SUPABASE_PROJECT_ID?.trim() || DEFAULT_PROJECT_ID;

// Guard the shell:true path below — a project ref is always [a-z0-9]{20}.
if (!/^[a-z0-9]{16,32}$/.test(projectId)) {
  fail(
    `SUPABASE_PROJECT_ID "${projectId}" is not a valid project ref.`,
    'Expected 16-32 lowercase alphanumeric characters.',
  );
}

console.log(`Generating types from project ${projectId} …`);

const isWindows = process.platform === 'win32';
const res = spawnSync(
  isWindows ? 'npx.cmd' : 'npx',
  ['supabase', 'gen', 'types', 'typescript', '--project-id', projectId],
  {
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    // Node >= 20 refuses to spawn a .cmd without a shell (EINVAL). projectId is
    // validated below, so nothing user-controlled reaches the shell unquoted.
    shell: isWindows,
  },
);

if (res.error) fail('Could not run the Supabase CLI.', res.error.message);
if (res.status !== 0) {
  // The CLI puts deprecation warnings on stderr and the actual failure (e.g.
  // `{"_tag":"Error", ... "Unauthorized"}`) on stdout, so show both — the old
  // `2>/dev/null` pipeline hid whichever one mattered.
  fail(
    `supabase gen types exited ${res.status}.`,
    [res.stdout?.trim(), res.stderr?.trim()].filter(Boolean).join('\n') || '(no output)',
  );
}

// The CLI reports some failures on stdout as JSON with a 0 exit code.
if (/"_tag"\s*:\s*"Error"/.test(res.stdout)) {
  fail('supabase gen types reported an error.', res.stdout.slice(0, 1000));
}

const module_ = extractModule(res.stdout);
if (!module_) {
  fail('Could not find a TypeScript module in the generator output.', res.stdout.slice(0, 1000));
}

const lineCount = validate(module_, 'generated output');

// Write to a temp file first, then move into place, so a failure anywhere above
// can never leave a partially-written database.ts behind.
const tmp = path.join(os.tmpdir(), `database.ts.${process.pid}`);
fs.writeFileSync(tmp, module_);
fs.renameSync(tmp, TARGET);

console.log(`✓ wrote packages/lib/src/types/database.ts (${lineCount.toLocaleString()} lines)`);
if (res.stderr?.trim()) {
  console.log('\nCLI diagnostics (non-fatal):');
  console.log(res.stderr.trimEnd());
}
console.log('\nNext: `npx turbo typecheck`. New errors are real drift that `as any` was hiding —');
console.log('fix them rather than re-adding the cast.');
