/**
 * Backfill notes_history from CSV into crm_records.data JSONB
 * For records that have Notes History in the Contacts CSV but not in the DB
 */
const fs = require('fs');
const path = require('path');

// Load env
const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

function parseCSVLine(line) {
  const fields = [];
  let inQuote = false;
  let field = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuote && i + 1 < line.length && line[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (c === ',' && !inQuote) {
      fields.push(field);
      field = '';
    } else {
      field += c;
    }
  }
  fields.push(field.replace(/\r$/, ''));
  return fields;
}

async function main() {
  const csvPath = 'c:/Users/User/Desktop/Contacts_2026_02_10_ALL/Contacts_2026_02_10.csv';
  console.log('Parsing CSV:', csvPath);
  
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n');
  const header = parseCSVLine(lines[0]);
  
  const colIdx = {};
  header.forEach((h, i) => colIdx[h] = i);
  
  const nhIdx = colIdx['Notes History'];
  const ridIdx = colIdx['Record Id'];
  
  // Collect all rows with notes_history and their Zoho Record Id
  const updates = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const fields = parseCSVLine(lines[i]);
    const nh = (fields[nhIdx] || '').trim();
    const rid = (fields[ridIdx] || '').trim();
    if (nh && rid) {
      updates.push({ zohoRecordId: rid, notesHistory: nh });
    }
  }
  
  console.log(`Found ${updates.length} CSV rows with Notes History to backfill`);
  
  // Process in batches - find record by zoho_record_id, update data
  let updated = 0;
  let notFound = 0;
  let alreadyHas = 0;
  
  const BATCH = 50;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    
    for (const { zohoRecordId, notesHistory } of batch) {
      try {
        // Find record by zoho_record_id
        const findRes = await fetch(
          `${SUPABASE_URL}/rest/v1/crm_records?data->>zoho_record_id=eq.${encodeURIComponent(zohoRecordId)}&select=id,data`,
          {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
            },
          }
        );
        
        const records = await findRes.json();
        if (!records || records.length === 0) {
          notFound++;
          continue;
        }
        
        const record = records[0];
        if (record.data?.notes_history && record.data.notes_history.trim()) {
          alreadyHas++;
          continue;
        }
        
        // Update the record's data to include notes_history
        const newData = { ...record.data, notes_history: notesHistory };
        const updateRes = await fetch(
          `${SUPABASE_URL}/rest/v1/crm_records?id=eq.${record.id}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal',
            },
            body: JSON.stringify({ data: newData }),
          }
        );
        
        if (updateRes.ok) {
          updated++;
        } else {
          console.error(`  Failed to update ${record.id}:`, await updateRes.text());
        }
      } catch (err) {
        console.error(`  Error for ${zohoRecordId}:`, err.message);
      }
    }
    
    process.stdout.write(`\r  Progress: ${Math.min(i + BATCH, updates.length)}/${updates.length} | Updated: ${updated} | Already has: ${alreadyHas} | Not found: ${notFound}`);
  }
  
  console.log('\n\n=== BACKFILL COMPLETE ===');
  console.log(`Updated: ${updated}`);
  console.log(`Already had notes_history: ${alreadyHas}`);
  console.log(`Not found in DB: ${notFound}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
