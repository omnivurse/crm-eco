#!/usr/bin/env node
/**
 * db:health — runs scripts/db-health-default-flags.sql against the linked
 * Supabase database. Detects any boolean is_default/is_primary column whose
 * "one default per parent" invariant has drifted (the same trap that broke
 * the edit page on PIFH for crm_layouts).
 *
 * Connection (first match wins):
 *   • PIFH_SUPABASE_DB_URL or SUPABASE_DB_URL
 *   • NEXT_PUBLIC_SUPABASE_URL + SUPABASE_DB_PASSWORD
 */
import dotenv from 'dotenv';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env') });

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
  runPsql(conn, 'scripts/db-health-default-flags.sql');
  process.exit(0);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
