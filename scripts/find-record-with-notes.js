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
  // Find records that have BOTH crm_notes AND notes_history
  // First get a few record_ids that have crm_notes
  const notesRes = await fetch(`${SUPABASE_URL}/rest/v1/crm_notes?select=record_id&order=created_at.desc&limit=100`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
  });
  const notes = await notesRes.json();
  const uniqueIds = [...new Set(notes.map(n => n.record_id))].slice(0, 10);
  
  console.log('Checking', uniqueIds.length, 'records with crm_notes...\n');
  
  for (const id of uniqueIds) {
    const recRes = await fetch(`${SUPABASE_URL}/rest/v1/crm_records?id=eq.${id}&select=id,title,email`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
    });
    const recs = await recRes.json();
    if (!recs[0]) continue;
    
    const countRes = await fetch(`${SUPABASE_URL}/rest/v1/crm_notes?record_id=eq.${id}&select=id`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: 'count=exact' }
    });
    const countRange = countRes.headers.get('content-range');
    
    console.log(`Record: ${recs[0].title} (${recs[0].email || 'no email'})`);
    console.log(`  URL: http://localhost:3000/crm/r/${id}`);
    console.log(`  Notes count: ${countRange}`);
    console.log('');
  }
}

main().catch(e => console.error('Error:', e));
