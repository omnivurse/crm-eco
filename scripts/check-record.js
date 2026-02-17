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

const RECORD_ID = '56d1c022-5c14-4e97-8da6-719fb7e80212';

async function main() {
  // Check the record
  const r = await fetch(`${SUPABASE_URL}/rest/v1/crm_records?id=eq.${RECORD_ID}&select=id,title,email,data`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
  });
  const records = await r.json();
  const rec = records[0];
  console.log('Record title:', rec?.title);
  console.log('Record email:', rec?.email);
  console.log('zoho_record_id:', rec?.data?.zoho_record_id || 'MISSING');
  console.log('notes_history present:', !!rec?.data?.notes_history);

  // Check crm_notes for this record
  const n = await fetch(`${SUPABASE_URL}/rest/v1/crm_notes?record_id=eq.${RECORD_ID}&select=id,body,created_at&limit=5&order=created_at.desc`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
  });
  const notes = await n.json();
  console.log('crm_notes linked to this record:', notes.length);
  notes.forEach((note, i) => {
    console.log(`  Note ${i}: created=${note.created_at}, body="${note.body?.substring(0, 80)}..."`);
  });

  // Count total notes in crm_notes
  const countRes = await fetch(`${SUPABASE_URL}/rest/v1/crm_notes?select=id&limit=1`, {
    method: 'GET',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: 'count=exact' }
  });
  const countRange = countRes.headers.get('content-range');
  console.log('\nTotal crm_notes in DB:', countRange);

  // Check how many records have notes linked
  const linkedRes = await fetch(`${SUPABASE_URL}/rest/v1/crm_notes?select=record_id&limit=5`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
  });
  const linkedNotes = await linkedRes.json();
  console.log('Sample record_ids with notes:', linkedNotes.map(n => n.record_id));

  // Check if the zoho_record_id exists and find its record
  if (rec?.data?.zoho_record_id) {
    console.log('\nZoho ID found, checking for notes via staging match...');
  } else {
    // Check if record has ANY zoho-related field
    const zohoKeys = Object.keys(rec?.data || {}).filter(k => k.includes('zoho'));
    console.log('\nZoho-related data keys:', zohoKeys.length > 0 ? zohoKeys : 'NONE');

    // Maybe the record was imported via the API route, not the SQL function
    // Check crm_import_rows for this record
    const importRes = await fetch(`${SUPABASE_URL}/rest/v1/crm_import_rows?record_id=eq.${RECORD_ID}&select=id,status,raw,normalized`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
    });
    const importRows = await importRes.json();
    console.log('Import rows for this record:', importRows.length);
    if (importRows.length > 0) {
      console.log('  Status:', importRows[0].status);
      console.log('  Has raw:', !!importRows[0].raw);
      console.log('  Has normalized:', !!importRows[0].normalized);
    }
  }
}

main().catch(e => console.error('Error:', e));
