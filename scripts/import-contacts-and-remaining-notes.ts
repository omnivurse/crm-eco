/**
 * Phase 2: Upsert contacts from staging (data already loaded) + re-import skipped notes.
 * Usage: npx tsx scripts/import-contacts-and-remaining-notes.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

function loadEnv(filePath: string): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    for (const line of readFileSync(filePath, 'utf-8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    }
  } catch { /* missing */ }
  return env;
}

const root = resolve(__dirname, '..');
const env = { ...loadEnv(resolve(root, '.env.local')), ...loadEnv(resolve(root, '.env')) };
const SUPABASE_URL = env['SUPABASE_URL'] || env['NEXT_PUBLIC_SUPABASE_URL'];
const SUPABASE_KEY = env['SUPABASE_SERVICE_ROLE_KEY'];
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing env'); process.exit(1); }

const hdrs = {
  'apikey': SUPABASE_KEY!,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

async function sbRpc(fn: string, params: Record<string, unknown> = {}, timeoutMs = 180_000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { ...hdrs, 'Prefer': 'return=representation' },
      body: JSON.stringify(params),
      signal: ac.signal,
    });
    const txt = await res.text();
    if (!res.ok) throw new Error(`RPC ${fn} (${res.status}): ${txt.slice(0, 500)}`);
    try { return JSON.parse(txt); } catch { return txt; }
  } finally { clearTimeout(t); }
}

async function main() {
  const TOTAL_CONTACTS = 14411;
  const TOTAL_NOTES = 98641;

  console.log('='.repeat(60));
  console.log('CONTACTS UPSERT (staging already loaded) + REMAINING NOTES');
  console.log('='.repeat(60));

  // Snapshot before
  const recsBefore = await fetch(
    `${SUPABASE_URL}/rest/v1/crm_records?select=id&limit=0`,
    { headers: { ...hdrs, 'Prefer': 'count=exact' } }
  );
  const rBefore = parseInt(recsBefore.headers.get('content-range')?.split('/')[1] || '0');
  const notesBefore = await fetch(
    `${SUPABASE_URL}/rest/v1/crm_notes?select=id&limit=0`,
    { headers: { ...hdrs, 'Prefer': 'count=exact' } }
  );
  const nBefore = parseInt(notesBefore.headers.get('content-range')?.split('/')[1] || '0');
  console.log(`Before: ${rBefore} records, ${nBefore} notes\n`);

  const t0 = Date.now();

  // Step 1: Upsert contacts
  console.log('[1] Upserting contacts from staging...');
  const BATCH = 500;
  let ins = 0, upd = 0, skip = 0, errs = 0;
  for (let off = 0; off < TOTAL_CONTACTS; off += BATCH) {
    try {
      const r = await sbRpc('upsert_contacts_batch', { p_offset: off, p_limit: BATCH });
      const row = Array.isArray(r) ? r[0] : r;
      ins += row.inserted || 0;
      upd += row.updated || 0;
      skip += row.skipped || 0;
      errs += row.errors || 0;
      const pct = Math.min(100, Math.round(((off + BATCH) / TOTAL_CONTACTS) * 100));
      process.stdout.write(`\r  Upserting: ${pct}% (${ins} new, ${upd} updated, ${errs} errors)`);
    } catch (e) {
      console.error(`\n  Batch err at ${off}: ${(e as Error).message.slice(0, 200)}`);
      errs += BATCH;
    }
  }
  console.log(`\n  Contacts: ${ins} inserted, ${upd} updated, ${skip} skipped, ${errs} errors`);

  // Step 2: Dedup
  console.log('\n[2] Deduplicating...');
  const dedup = await sbRpc('deduplicate_contacts');
  console.log('  Dedup:', JSON.stringify(dedup));

  // Step 3: Re-import notes (staging still has all 98K, dedup check will skip already-imported)
  console.log('\n[3] Re-importing notes (will skip already imported)...');
  const N_BATCH = 1000;
  let nImp = 0, nSkip = 0, nErr = 0;
  for (let off = 0; off < TOTAL_NOTES; off += N_BATCH) {
    try {
      const r = await sbRpc('import_notes_batch', { p_offset: off, p_limit: N_BATCH });
      const row = Array.isArray(r) ? r[0] : r;
      nImp += row.imported || 0;
      nSkip += row.skipped || 0;
      nErr += row.errors || 0;
      const pct = Math.min(100, Math.round(((off + N_BATCH) / TOTAL_NOTES) * 100));
      process.stdout.write(`\r  Notes: ${pct}% (${nImp} imported, ${nSkip} skipped)`);
    } catch (e) {
      console.error(`\n  Batch err at ${off}: ${(e as Error).message.slice(0, 200)}`);
      nErr += N_BATCH;
    }
  }
  console.log(`\n  Notes: ${nImp} imported, ${nSkip} skipped, ${nErr} errors`);

  // Final counts
  const recsAfter = await fetch(
    `${SUPABASE_URL}/rest/v1/crm_records?select=id&limit=0`,
    { headers: { ...hdrs, 'Prefer': 'count=exact' } }
  );
  const rAfter = parseInt(recsAfter.headers.get('content-range')?.split('/')[1] || '0');
  const notesAfter = await fetch(
    `${SUPABASE_URL}/rest/v1/crm_notes?select=id&limit=0`,
    { headers: { ...hdrs, 'Prefer': 'count=exact' } }
  );
  const nAfter = parseInt(notesAfter.headers.get('content-range')?.split('/')[1] || '0');

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('\n' + '='.repeat(60));
  console.log('COMPLETE');
  console.log('='.repeat(60));
  console.log(`Time: ${elapsed}s`);
  console.log(`Records: ${rBefore} → ${rAfter} (${rAfter - rBefore >= 0 ? '+' : ''}${rAfter - rBefore})`);
  console.log(`Notes:   ${nBefore} → ${nAfter} (${nAfter - nBefore >= 0 ? '+' : ''}${nAfter - nBefore})`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
