const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.resolve(__dirname, '../.env.local'), 'utf-8');
const env = {};
envContent.split('\n').forEach(l => {
  const m = l.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (m) env[m[1].trim()] = m[2].trim();
});

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  // 1. Check if "zcrm_1579374000180451002" appears in the notes CSV
  const zohoId = 'zcrm_1579374000180451002';
  
  function parseCSVLine(line) {
    const fields = [];
    let inQuote = false;
    let field = '';
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuote && i + 1 < line.length && line[i + 1] === '"') { field += '"'; i++; }
        else inQuote = !inQuote;
      } else if (c === ',' && !inQuote) { fields.push(field); field = ''; }
      else field += c;
    }
    fields.push(field.replace(/\r$/, ''));
    return fields;
  }
  
  const csvPath = 'c:/Users/User/Downloads/Notes_Contacts_2026_02_10_WS_Notes/Notes_Contacts_2026_02_10.csv';
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n');
  const header = parseCSVLine(lines[0]);
  const parentIdIdx = header.indexOf('Parent ID.id');
  
  let matchCount = 0;
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const fields = parseCSVLine(lines[i]);
    if (fields[parentIdIdx]?.trim() === zohoId) matchCount++;
  }
  console.log(`Notes in CSV for ${zohoId}: ${matchCount}`);
  
  // 2. Pick a record that HAS notes and verify it works
  const sampleId = 'ec50d05c-3179-45b5-8800-c2e8dfc355fd';
  const r = await fetch(`${SUPABASE_URL}/rest/v1/crm_records?id=eq.${sampleId}&select=id,title,email,data`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
  });
  const recs = await r.json();
  console.log('\nSample record WITH notes:');
  console.log('  Title:', recs[0]?.title);
  console.log('  Email:', recs[0]?.email);
  console.log('  zoho_record_id:', recs[0]?.data?.zoho_record_id);
  console.log('  has notes_history:', !!recs[0]?.data?.notes_history);
  
  const n = await fetch(`${SUPABASE_URL}/rest/v1/crm_notes?record_id=eq.${sampleId}&select=id,body,created_at&limit=3&order=created_at.desc`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
  });
  const notes = await n.json();
  console.log('  crm_notes count:', notes.length, '(showing first 3)');
  notes.forEach((note, i) => {
    console.log(`    Note ${i}: "${note.body?.substring(0, 100)}..."`);
  });

  // 3. Count how many records have at least 1 note
  const countRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  
  // Count distinct record_ids in crm_notes
  const distinctRes = await fetch(`${SUPABASE_URL}/rest/v1/crm_notes?select=record_id&limit=50000`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
  });
  const allNotes = await distinctRes.json();
  const uniqueRecords = new Set(allNotes.map(n => n.record_id));
  console.log('\nUnique records with crm_notes (sample of up to 50k):', uniqueRecords.size);
}

main().catch(e => console.error('Error:', e));
