import { readFileSync } from 'fs';
import { resolve } from 'path';

function loadEnv(fp: string): Record<string, string> {
  const e: Record<string, string> = {};
  try {
    for (const l of readFileSync(fp, 'utf-8').split('\n')) {
      const t = l.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      e[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    }
  } catch { /* missing */ }
  return e;
}

const root = resolve(__dirname, '..');
const env = { ...loadEnv(resolve(root, '.env.local')), ...loadEnv(resolve(root, '.env')) };
const SUPABASE_URL = env['SUPABASE_URL'] || env['NEXT_PUBLIC_SUPABASE_URL'];
const KEY = env['SUPABASE_SERVICE_ROLE_KEY'];
const hdrs = {
  'apikey': KEY!,
  'Authorization': `Bearer ${KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
};

async function main() {
  console.log('Retrying contacts batch at offset 6500, limit 500...');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/upsert_contacts_batch`, {
    method: 'POST',
    headers: hdrs,
    body: JSON.stringify({ p_offset: 6500, p_limit: 500 }),
    signal: AbortSignal.timeout(180_000),
  });
  const txt = await res.text();
  console.log('Status:', res.status);
  console.log('Result:', txt.slice(0, 500));

  console.log('\nRetrying notes batch at offset 94000, limit 1000...');
  const res2 = await fetch(`${SUPABASE_URL}/rest/v1/rpc/import_notes_batch`, {
    method: 'POST',
    headers: hdrs,
    body: JSON.stringify({ p_offset: 94000, p_limit: 1000 }),
    signal: AbortSignal.timeout(180_000),
  });
  const txt2 = await res2.text();
  console.log('Status:', res2.status);
  console.log('Result:', txt2.slice(0, 500));

  // Final counts
  console.log('\nFinal counts:');
  const r = await fetch(`${SUPABASE_URL}/rest/v1/crm_records?select=id&limit=0`, {
    headers: { ...hdrs, 'Prefer': 'count=exact' },
  });
  const n = await fetch(`${SUPABASE_URL}/rest/v1/crm_notes?select=id&limit=0`, {
    headers: { ...hdrs, 'Prefer': 'count=exact' },
  });
  console.log('Records:', r.headers.get('content-range'));
  console.log('Notes:', n.headers.get('content-range'));
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
