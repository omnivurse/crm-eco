/**
 * Ingest Zoho Notes CSVs into CRM via import_notes_staging + import_notes_batch
 * 
 * Usage: node scripts/ingest-notes.js
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

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

console.log('Supabase URL:', SUPABASE_URL);

// CSV files to process
const CSV_FILES = [
  'c:/Users/User/Downloads/Notes_Contacts_2026_02_10_WS_Notes/Notes_Contacts_2026_02_10.csv',
  'c:/Users/User/Downloads/Notes_Leads_2026_02_10_WS_Notes/Notes_Leads_2026_02_10.csv',
];

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

async function supabaseRequest(endpoint, method, body) {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': method === 'POST' ? 'return=minimal' : undefined,
  };
  Object.keys(headers).forEach(k => headers[k] === undefined && delete headers[k]);
  
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${method} ${endpoint}: ${res.status} ${text}`);
  }
  
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('json')) {
    return res.json();
  }
  return null;
}

async function supabaseRPC(fn, params) {
  const url = `${SUPABASE_URL}/rest/v1/rpc/${fn}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params || {}),
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase RPC ${fn}: ${res.status} ${text}`);
  }
  
  return res.json();
}

function parseCSVFile(filePath) {
  console.log(`\nParsing: ${filePath}`);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const header = parseCSVLine(lines[0]);
  
  const colIdx = {};
  header.forEach((h, i) => colIdx[h] = i);
  
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const fields = parseCSVLine(lines[i]);
    
    const noteContent = (fields[colIdx['Note Content']] || '').trim();
    const parentId = (fields[colIdx['Parent ID.id']] || '').trim();
    
    if (!noteContent || !parentId) continue;
    
    rows.push({
      record_id: (fields[colIdx['Record Id']] || '').trim(),
      associated_id: (fields[colIdx['Associated_Id']] || '').trim(),
      created_by_id: (fields[colIdx['Created By.id']] || '').trim(),
      created_by: (fields[colIdx['Created By']] || '').trim(),
      created_time: (fields[colIdx['Created Time']] || '').trim(),
      modified_by_id: (fields[colIdx['Modified By.id']] || '').trim(),
      modified_by: (fields[colIdx['Modified By']] || '').trim(),
      modified_time: (fields[colIdx['Modified Time']] || '').trim(),
      note_content: noteContent,
      note_owner_id: (fields[colIdx['Note Owner.id']] || '').trim(),
      note_owner: (fields[colIdx['Note Owner']] || '').trim(),
      note_title: (fields[colIdx['Note Title']] || '').trim(),
      parent_id: parentId,
      parent_name: (fields[colIdx['Parent ID']] || '').trim(),
    });
  }
  
  console.log(`  Parsed ${rows.length} valid notes (with content + parent ID)`);
  return rows;
}

async function main() {
  // Step 1: Parse all CSV files
  let allNotes = [];
  for (const csvFile of CSV_FILES) {
    const notes = parseCSVFile(csvFile);
    allNotes = allNotes.concat(notes);
  }
  console.log(`\nTotal notes to ingest: ${allNotes.length}`);
  
  // Step 2: Clear the staging table via RPC (TRUNCATE)
  console.log('\nClearing import_notes_staging...');
  try {
    const truncRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    // Fallback: delete with a broad filter
    const delRes = await fetch(`${SUPABASE_URL}/rest/v1/import_notes_staging?row_num=gte.0`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=minimal',
      },
    });
    if (delRes.ok) {
      console.log('  Staging table cleared');
    } else {
      console.log('  Warning clearing staging:', await delRes.text());
    }
  } catch (err) {
    console.log('  Warning clearing staging:', err.message);
  }
  
  // Step 3: Insert notes into staging in batches
  const BATCH_SIZE = 500;
  let inserted = 0;
  
  for (let i = 0; i < allNotes.length; i += BATCH_SIZE) {
    const batch = allNotes.slice(i, i + BATCH_SIZE);
    
    try {
      await supabaseRequest('import_notes_staging', 'POST', batch);
      inserted += batch.length;
      process.stdout.write(`\r  Inserted ${inserted}/${allNotes.length} into staging...`);
    } catch (err) {
      console.error(`\n  Error inserting batch at offset ${i}:`, err.message);
      // Try smaller batches
      for (const row of batch) {
        try {
          await supabaseRequest('import_notes_staging', 'POST', [row]);
          inserted++;
        } catch (e) {
          console.error(`  Skipped row ${row.record_id}:`, e.message);
        }
      }
    }
  }
  console.log(`\n  Total inserted into staging: ${inserted}`);
  
  // Step 4: Run import_notes_batch in chunks
  console.log('\nRunning import_notes_batch...');
  let totalImported = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let offset = 0;
  const IMPORT_BATCH = 1000;
  
  while (true) {
    try {
      const result = await supabaseRPC('import_notes_batch', {
        p_offset: offset,
        p_limit: IMPORT_BATCH,
      });
      
      const row = Array.isArray(result) ? result[0] : result;
      if (!row) {
        console.log('  No more results from import_notes_batch');
        break;
      }
      
      const { imported = 0, skipped = 0, errors = 0 } = row;
      totalImported += imported;
      totalSkipped += skipped;
      totalErrors += errors;
      
      console.log(`  Batch at offset ${offset}: imported=${imported}, skipped=${skipped}, errors=${errors}`);
      
      if (imported === 0 && skipped === 0 && errors === 0) {
        break;
      }
      
      offset += IMPORT_BATCH;
    } catch (err) {
      console.error(`  Error at offset ${offset}:`, err.message);
      break;
    }
  }
  
  console.log('\n=== IMPORT COMPLETE ===');
  console.log(`Imported: ${totalImported}`);
  console.log(`Skipped: ${totalSkipped}`);
  console.log(`Errors: ${totalErrors}`);
  
  // Step 5: Verify - count notes in crm_notes
  try {
    const countRes = await fetch(`${SUPABASE_URL}/rest/v1/crm_notes?select=id&limit=1`, {
      method: 'HEAD',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'count=exact',
      },
    });
    const totalNotes = countRes.headers.get('content-range');
    console.log(`\nTotal crm_notes in DB: ${totalNotes}`);
  } catch (e) {
    console.log('Could not count notes:', e.message);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
