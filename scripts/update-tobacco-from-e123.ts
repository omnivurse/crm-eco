/**
 * Matches E123 tobacco users to CRM records and sets tobacco_user = true.
 * Matching strategy: email (case-insensitive), then first+last name fallback.
 */
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
if (!SUPABASE_URL || !KEY) { console.error('Missing env'); process.exit(1); }

const hdrs = {
  'apikey': KEY!,
  'Authorization': `Bearer ${KEY}`,
  'Content-Type': 'application/json',
};

// ── Parse CSV (handles quoted fields) ──
function parseCSV(text: string): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  const lines: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') { inQuote = !inQuote; cur += ch; }
    else if (ch === '\n' && !inQuote) { lines.push(cur); cur = ''; }
    else if (ch === '\r' && !inQuote) { /* skip */ }
    else { cur += ch; }
  }
  if (cur.trim()) lines.push(cur);

  const headerLine = lines[0];
  const headers = splitCSVLine(headerLine);
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const vals = splitCSVLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j].trim()] = (vals[j] || '').trim();
    }
    rows.push(row);
  }
  return rows;
}

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; }
    else if (ch === ',' && !inQ) { result.push(cur); cur = ''; }
    else { cur += ch; }
  }
  result.push(cur);
  return result;
}

interface TobaccoUser {
  memberID: string;
  firstName: string;
  lastName: string;
  email: string;
  recordType: string; // PRIMARY or DEPENDENT
  hasFee: boolean;
}

async function main() {
  const csvPath = '/Users/qloudagent/Desktop/Tobacco_359546_Members_FULL_WITH_DEPENDENT_032026103721 copy.csv';
  const raw = readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(raw);

  // Extract unique tobacco users (by email or name)
  const seen = new Set<string>();
  const tobaccoUsers: TobaccoUser[] = [];
  for (const r of rows) {
    if (r['Tobacco Use']?.trim() !== 'Yes') continue;
    const key = (r['Email'] || `${r['First Name']}|${r['Last Name']}`).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tobaccoUsers.push({
      memberID: r['Member ID']?.trim() || '',
      firstName: r['First Name']?.trim() || '',
      lastName: r['Last Name']?.trim() || '',
      email: r['Email']?.trim() || '',
      recordType: r['Record Type']?.trim() || '',
      hasFee: parseFloat(r['TobaccoUse Fee'] || '0') > 0,
    });
  }

  console.log(`Found ${tobaccoUsers.length} unique tobacco users in E123 data`);
  console.log('');

  let matched = 0;
  let notFound = 0;
  const notFoundList: string[] = [];

  for (const tu of tobaccoUsers) {
    let crmRecordId: string | null = null;

    // Strategy 1: Match by email
    if (tu.email) {
      const emailLower = tu.email.toLowerCase();
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/crm_records?select=id,title,email,tobacco_user&or=(email.ilike.${encodeURIComponent(emailLower)},data->>email.ilike.${encodeURIComponent(emailLower)})&org_id=eq.ac6e7228-2ea0-4582-8464-562c3e8ac56e&limit=1`,
        { headers: hdrs }
      );
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        crmRecordId = data[0].id;
      }
    }

    // Strategy 2: Match by first + last name
    if (!crmRecordId) {
      const fn = tu.firstName;
      const ln = tu.lastName;
      if (fn && ln) {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/crm_records?select=id,title,email,tobacco_user&title=ilike.${encodeURIComponent(`${fn} ${ln}`)}&org_id=eq.ac6e7228-2ea0-4582-8464-562c3e8ac56e&limit=1`,
          { headers: hdrs }
        );
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          crmRecordId = data[0].id;
        }
      }
    }

    // Strategy 3: For dependents, find the primary member's record and check if this person
    // is stored as a spouse or child name in the data JSONB
    if (!crmRecordId && tu.recordType === 'DEPENDENT') {
      const searchName = `${tu.firstName} ${tu.lastName}`;
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/crm_records?select=id,title,data&or=(data->>spouse.ilike.${encodeURIComponent(`%${searchName}%`)},data->>child_1.ilike.${encodeURIComponent(`%${tu.firstName}%`)},data->>child_2.ilike.${encodeURIComponent(`%${tu.firstName}%`)},data->>child_3.ilike.${encodeURIComponent(`%${tu.firstName}%`)},data->>child_4.ilike.${encodeURIComponent(`%${tu.firstName}%`)},data->>child_5.ilike.${encodeURIComponent(`%${tu.firstName}%`)})&org_id=eq.ac6e7228-2ea0-4582-8464-562c3e8ac56e&limit=1`,
        { headers: hdrs }
      );
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        crmRecordId = data[0].id;
        console.log(`  [dep→parent] ${tu.firstName} ${tu.lastName} → ${data[0].title}`);
      }
    }

    if (crmRecordId) {
      // Update tobacco_user = true
      const patchRes = await fetch(
        `${SUPABASE_URL}/rest/v1/crm_records?id=eq.${crmRecordId}`,
        {
          method: 'PATCH',
          headers: { ...hdrs, 'Prefer': 'return=minimal' },
          body: JSON.stringify({ tobacco_user: true }),
        }
      );
      if (patchRes.ok) {
        matched++;
        console.log(`  ✓ ${tu.firstName} ${tu.lastName} (${tu.email || 'no email'}) → updated`);
      } else {
        console.log(`  ✗ ${tu.firstName} ${tu.lastName} — PATCH failed: ${patchRes.status}`);
      }
    } else {
      notFound++;
      notFoundList.push(`${tu.firstName} ${tu.lastName} (${tu.email || 'no email'}, ${tu.recordType}, MID:${tu.memberID})`);
      console.log(`  ? ${tu.firstName} ${tu.lastName} (${tu.email || 'no email'}) — NOT FOUND in CRM`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Matched & updated: ${matched}`);
  console.log(`Not found in CRM:  ${notFound}`);
  if (notFoundList.length > 0) {
    console.log('\nUnmatched:');
    for (const n of notFoundList) console.log(`  - ${n}`);
  }

  // Verify final count
  const verifyRes = await fetch(
    `${SUPABASE_URL}/rest/v1/crm_records?select=id&tobacco_user=eq.true&org_id=eq.ac6e7228-2ea0-4582-8464-562c3e8ac56e&limit=0`,
    { headers: { ...hdrs, 'Prefer': 'count=exact' } }
  );
  const count = verifyRes.headers.get('content-range')?.split('/')[1] || '?';
  console.log(`\nCRM records with tobacco_user=true: ${count}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
