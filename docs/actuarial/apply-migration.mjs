/**
 * @fileoverview Applies a SQL migration file directly via Supabase pooler.
 * Usage: node docs/actuarial/apply-migration.mjs <migration-file>
 */
import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = join(__dirname, '..', '..', 'apps', 'admin', '.env.local');
  const raw = readFileSync(envPath, 'utf-8');
  const vars = {};
  for (const line of raw.split('\n')) {
    const match = line.match(/^([A-Z_]+)=["']?(.+?)["']?\s*$/);
    if (match) vars[match[1]] = match[2];
  }
  return vars;
}

async function main() {
  const migrationFile = process.argv[2];
  if (!migrationFile) {
    console.error('Usage: node docs/actuarial/apply-migration.mjs <path-to-sql-file>');
    process.exit(1);
  }

  const env = loadEnv();
  const poolerUrl = readFileSync(
    join(__dirname, '..', '..', 'supabase', '.temp', 'pooler-url'),
    'utf-8'
  ).trim();

  const dbPassword = process.env.SUPABASE_DB_PASSWORD || env.SUPABASE_DB_PASSWORD;
  if (!dbPassword) {
    console.error('Set SUPABASE_DB_PASSWORD environment variable.');
    console.error('  export SUPABASE_DB_PASSWORD="your-db-password"');
    console.error('  node docs/actuarial/apply-migration.mjs <file>');
    process.exit(1);
  }

  const connUrl = poolerUrl.replace('postgresql://postgres.', `postgresql://postgres.`).replace('@', `:${dbPassword}@`);

  const sql = postgres(connUrl, { ssl: 'require', max: 1 });

  const migration = readFileSync(migrationFile, 'utf-8');
  console.log(`Applying migration: ${migrationFile}\n`);

  try {
    await sql.unsafe(migration);
    console.log('Migration applied successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
