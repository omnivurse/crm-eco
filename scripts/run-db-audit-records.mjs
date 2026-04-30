#!/usr/bin/env node
/**
 * CRM DB reporting + optional strict integrity asserts.
 *
 * Connection (first match wins):
 *   • PIFH_SUPABASE_DB_URL or SUPABASE_DB_URL — preferred in CI / deploy gate
 *   • NEXT_PUBLIC_SUPABASE_URL + SUPABASE_DB_PASSWORD — local .env
 *
 * Flags:
 *   • --strict  — after the report, run db-audit-crm-integrity-strict.sql (RAISE if corrupted)
 */
import dotenv from 'dotenv';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env') });

const strict = process.argv.includes('--strict');

function connectionUrl() {
  const pooled =
    process.env.PIFH_SUPABASE_DB_URL?.trim() ||
    process.env.SUPABASE_DB_URL?.trim() ||
    '';
  if (pooled) return pooled;

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const pass = process.env.SUPABASE_DB_PASSWORD || '';
  const refMatch = base.match(/^https:\/\/([^.]+)\.supabase\.co/i);
  const ref = refMatch?.[1];

  if (!ref || !pass) {
    throw new Error(
      'Missing DB credentials: set PIFH_SUPABASE_DB_URL or SUPABASE_DB_URL, ' +
        'or NEXT_PUBLIC_SUPABASE_URL + SUPABASE_DB_PASSWORD in .env',
    );
  }

  const encoded = encodeURIComponent(pass);
  return `postgresql://postgres:${encoded}@db.${ref}.supabase.co:5432/postgres?sslmode=require`;
}

function runPsql(conn, sqlRelPath) {
  const file = path.join(root, sqlRelPath);
  const r = spawnSync('psql', ['-v', 'ON_ERROR_STOP=1', conn, '-f', file], {
    stdio: 'inherit',
    env: process.env,
  });

  if (r.error) {
    console.error(
      '`psql` not found. Install PostgreSQL client tools (macOS: `brew install libpq`).',
    );
    process.exit(127);
  }

  const code = typeof r.status === 'number' ? r.status : 1;
  if (code !== 0) process.exit(code);
}

try {
  const conn = connectionUrl();
  runPsql(conn, 'scripts/db-audit-crm-record-integrity.sql');

  if (!strict) {
    process.exit(0);
  }

  console.log('\n=== Strict integrity assertions (--strict / CI) ===\n');
  runPsql(conn, 'scripts/db-audit-crm-integrity-strict.sql');
  process.exit(0);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
