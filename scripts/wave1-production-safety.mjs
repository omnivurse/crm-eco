#!/usr/bin/env node
/**
 * Wave 1 — Production Safety operator script
 *
 * Read-only discovery + optional migration push when DB URL is set.
 *
 * Usage:
 *   # Discovery only (uses cached .audit/schema if present)
 *   node scripts/wave1-production-safety.mjs
 *
 *   # Refresh live schema + crossref (requires prod read-only URL)
 *   PIFH_SUPABASE_DB_URL='postgresql://...' node scripts/wave1-production-safety.mjs --refresh
 *
 *   # Show pending migrations vs live ledger
 *   PIFH_SUPABASE_DB_URL='postgresql://...' node scripts/wave1-production-safety.mjs --pending
 *
 *   # Dry-run push (Supabase CLI must be linked to project)
 *   node scripts/wave1-production-safety.mjs --dry-run
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const MIG_DIR = join(ROOT, 'supabase/migrations');
const args = new Set(process.argv.slice(2));

/** Incremental migrations only — never replay squashed baseline on prod. */
const BASELINE_VERSIONS = new Set(['00000000000000', '00000000000001']);

function repoMigrations() {
  return readdirSync(MIG_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({ version: f.split('_')[0], file: f }));
}

function readAppliedFromCsv() {
  const path = join(ROOT, '.audit/schema/applied_migrations.csv');
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf8')
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

function readAppliedFromPsql() {
  const url = process.env.PIFH_SUPABASE_DB_URL || process.env.SUPABASE_DB_URL;
  if (!url) return null;
  const out = execSync(
    `psql "${url}" -t -A -c "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version"`,
    { encoding: 'utf8' },
  );
  return out.trim().split('\n').filter(Boolean);
}

function pendingMigrations(applied) {
  const appliedSet = new Set(applied);
  return repoMigrations().filter(({ version }) => !appliedSet.has(version));
}

function runRefresh() {
  const url = process.env.PIFH_SUPABASE_DB_URL || process.env.SUPABASE_DB_URL;
  if (!url) {
    console.error('Set PIFH_SUPABASE_DB_URL for --refresh');
    process.exit(1);
  }
  execSync('.audit/scripts/refresh-schema.sh', { stdio: 'inherit', env: { ...process.env, PIFH_SUPABASE_DB_URL: url } });
  execSync('node .audit/scripts/inventory.mjs', { stdio: 'inherit' });
  execSync('node .audit/scripts/crossref.mjs', { stdio: 'inherit' });
  execSync('node .audit/scripts/check-baseline.mjs', { stdio: 'inherit' });
}

function main() {
  console.log('=== DHH Wave 1 — Production Safety ===\n');

  const repo = repoMigrations();
  console.log(`Repo migrations: ${repo.length}`);

  const dupPrefixes = repo.reduce((acc, m) => {
    acc[m.version] = (acc[m.version] || 0) + 1;
    return acc;
  }, {});
  const dups = Object.entries(dupPrefixes).filter(([, n]) => n > 1);
  if (dups.length) {
    console.error('FAIL: duplicate migration version prefix(es):', dups.map(([v]) => v).join(', '));
    process.exit(1);
  }
  console.log('OK: no duplicate migration timestamps in repo\n');

  if (args.has('--refresh')) {
    runRefresh();
    return;
  }

  const applied = readAppliedFromPsql() ?? readAppliedFromCsv();
  if (!applied) {
    console.log('No applied migration source. Set PIFH_SUPABASE_DB_URL or run refresh first.\n');
  } else {
    const source = readAppliedFromPsql() ? 'live DB' : 'cached .audit/schema/applied_migrations.csv';
    console.log(`Applied migrations (${source}): ${applied.length}`);
    const pending = pendingMigrations(applied);
    const incremental = pending.filter(({ version }) => !BASELINE_VERSIONS.has(version));
    console.log(`Pending (all): ${pending.length}`);
    console.log(`Pending (incremental — safe to push): ${incremental.length}\n`);
    if (args.has('--pending') || incremental.length) {
      console.log('Incremental apply order:');
      for (const m of incremental) console.log(`  ${m.version}  ${m.file}`);
      console.log('');
    }
  }

  if (args.has('--dry-run')) {
    console.log('Running: supabase db push --dry-run\n');
    execSync('supabase db push --dry-run', { stdio: 'inherit' });
  }

  console.log('Next steps: see docs/audit/DHH-REPAIR-WAVE1-PRODUCTION-SAFETY.md');
}

main();
