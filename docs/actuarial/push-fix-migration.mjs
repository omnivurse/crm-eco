/**
 * @fileoverview Applies the round() fix migration via Supabase SQL execution.
 * Uses the Management API to run SQL directly against the database.
 *
 * Usage: SUPABASE_ACCESS_TOKEN=<token> node docs/actuarial/push-fix-migration.mjs
 *   OR:  node docs/actuarial/push-fix-migration.mjs  (uses CLI stored token)
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_REF = 'sffisarikcreyyjzdjvb';

function getAccessToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN;

  const configPaths = [
    join(homedir(), '.config', 'supabase', 'access-token'),
    join(homedir(), 'Library', 'Application Support', 'supabase', 'access-token'),
  ];

  for (const p of configPaths) {
    if (existsSync(p)) {
      return readFileSync(p, 'utf-8').trim();
    }
  }

  return null;
}

async function main() {
  const token = getAccessToken();

  if (!token) {
    console.error('No Supabase access token found.');
    console.error('Run: supabase login');
    console.error('Or set: SUPABASE_ACCESS_TOKEN=<your-token>');
    process.exit(1);
  }

  const migrationPath = join(__dirname, '..', '..', 'supabase', 'migrations', '202602190003_fix_round_casts.sql');
  const sql = readFileSync(migrationPath, 'utf-8');

  console.log(`Applying fix migration to project: ${PROJECT_REF}`);
  console.log(`SQL length: ${sql.length} chars\n`);

  const resp = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error(`API error (${resp.status}):`, errText);

    if (resp.status === 403 || resp.status === 401) {
      console.log('\nThis project may belong to a different Supabase account.');
      console.log('Apply the fix migration manually via the Supabase dashboard SQL editor:');
      console.log(`  https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`);
      console.log(`  Paste contents of: supabase/migrations/202602190003_fix_round_casts.sql`);
    }
    process.exit(1);
  }

  const result = await resp.json();
  console.log('Migration applied successfully.');
  console.log('Result:', JSON.stringify(result).substring(0, 200));
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
