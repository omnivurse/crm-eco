/**
 * Quick check: verify RPC functions exist on remote database
 * Usage: npx tsx scripts/check-rpc-functions.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

function loadEnv(filePath: string): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    const content = readFileSync(filePath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      val = val.replace(/^["']|["']$/g, '');
      env[key] = val;
    }
  } catch { /* file not found */ }
  return env;
}

const envFile = loadEnv(resolve(__dirname, '..', '.env.local'));
const SUPABASE_URL = envFile['SUPABASE_URL'] || envFile['VITE_SUPABASE_URL'] || envFile['NEXT_PUBLIC_SUPABASE_URL'] || process.env.SUPABASE_URL;
const SUPABASE_KEY = envFile['SUPABASE_SERVICE_ROLE_KEY'] || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

async function checkRpc(fnName: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY!,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: '{}',
  });
  const status = res.status;
  const text = await res.text();
  const exists = status !== 404;
  console.log(`  ${fnName}: ${exists ? 'EXISTS' : 'MISSING'} (HTTP ${status})`);
  if (!exists) {
    console.log(`    Response: ${text.slice(0, 200)}`);
  }
  return exists;
}

async function checkTable(tableName: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}?select=row_num&limit=1`, {
    headers: {
      'apikey': SUPABASE_KEY!,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  });
  const exists = res.ok;
  console.log(`  ${tableName}: ${exists ? 'ACCESSIBLE' : 'NOT FOUND'} (HTTP ${res.status})`);
  return exists;
}

async function main() {
  console.log(`Checking against: ${SUPABASE_URL}\n`);

  console.log('Staging tables:');
  const t1 = await checkTable('import_contacts_staging');
  const t2 = await checkTable('import_notes_staging');

  console.log('\nRPC functions:');
  const f1 = await checkRpc('upsert_contacts_from_staging');
  const f2 = await checkRpc('deduplicate_contacts');
  const f3 = await checkRpc('import_notes_from_staging');

  console.log('\nAlso checking current record counts:');
  const contactsRes = await fetch(`${SUPABASE_URL}/rest/v1/crm_records?select=id&module_id=eq.${encodeURIComponent('7913796d-bda6-4fff-b81d-5f707b06b71b')}&limit=1`, {
    headers: {
      'apikey': SUPABASE_KEY!,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'count=exact',
    },
  });
  const contactCount = contactsRes.headers.get('content-range');
  console.log(`  crm_records (contacts module): ${contactCount}`);

  const notesRes = await fetch(`${SUPABASE_URL}/rest/v1/crm_notes?select=id&limit=1`, {
    headers: {
      'apikey': SUPABASE_KEY!,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'count=exact',
    },
  });
  const notesCount = notesRes.headers.get('content-range');
  console.log(`  crm_notes: ${notesCount}`);

  const allOk = t1 && t2 && f1 && f2 && f3;
  console.log(`\n${allOk ? 'All checks passed - ready to run import!' : 'SOME CHECKS FAILED - see above'}`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
