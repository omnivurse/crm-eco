#!/usr/bin/env node
/**
 * Rehearse lead conversion migrations in a rolled-back transaction (read-only outcome).
 * Applies function replacements + row normalization counts without persisting changes.
 *
 * Usage:
 *   node scripts/rehearse-lead-conversion-migration.mjs
 *
 * Requires SUPABASE_DB_PASSWORD and NEXT_PUBLIC_SUPABASE_URL in .env.local
 * Uses psql against db.<project-ref>.supabase.co
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    try {
      readFileSync(resolve(process.cwd(), file), 'utf8')
        .split('\n')
        .forEach((line) => {
          const m = line.match(/^([^#=]+)=(.*)$/);
          if (!m) continue;
          const key = m[1].trim();
          const val = m[2].trim().replace(/^["']|["']$/g, '');
          if (!process.env[key]) process.env[key] = val;
        });
    } catch {
      /* optional */
    }
  }
}

loadEnv();

const dbUrl =
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL;

if (!dbUrl) {
  console.error('Missing SUPABASE_DB_URL / DATABASE_URL for rehearsal');
  process.exit(1);
}

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/202606150003_harden_lead_conversion_paths.sql',
);
const sql = readFileSync(migrationPath, 'utf8');

async function main() {
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    await client.query('BEGIN');
    console.log('Rehearsing migration in transaction (will ROLLBACK)...\n');

    await client.query(sql);

    const { rows: stageRows } = await client.query(`
      SELECT COUNT(*)::int AS n
      FROM crm_records cr
      JOIN crm_modules m ON m.id = cr.module_id AND m.key = 'leads'
      WHERE cr.status = 'Converted' AND cr.stage = 'Converted'
    `);

    const { rows: fnRows } = await client.query(`
      SELECT proname FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND proname IN ('convert_lead_to_contact', 'convert_lead_to_member')
    `);

    console.log(`Converted leads with stage=Converted (after rehearsal): ${stageRows[0]?.n ?? 0}`);
    console.log(`Functions present: ${fnRows.map((r) => r.proname).join(', ')}`);
    console.log('\nRehearsal OK — rolling back.');
    await client.query('ROLLBACK');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Rehearsal FAILED (rolled back):', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
