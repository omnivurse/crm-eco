const fs = require('fs');

function parseCSVLine(line) {
  const fields = [];
  let inQuote = false;
  let field = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuote = !inQuote;
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

function analyzeFile(path, label) {
  console.log(`\n=== ${label} ===`);
  const content = fs.readFileSync(path, 'utf-8');
  const lines = content.split('\n');
  const header = parseCSVLine(lines[0]);
  
  console.log('Columns:', header.join(' | '));
  
  const colIdx = {};
  header.forEach((h, i) => colIdx[h] = i);
  
  let total = 0;
  let withContent = 0;
  let withParentId = 0;
  const parentIds = new Set();
  const samples = [];
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    total++;
    const fields = parseCSVLine(lines[i]);
    
    const noteContent = fields[colIdx['Note Content']] || '';
    const parentId = fields[colIdx['Parent ID.id']] || fields[colIdx['Parent ID']] || '';
    const createdTime = fields[colIdx['Created Time']] || '';
    const noteTitle = fields[colIdx['Note Title']] || '';
    
    if (noteContent.trim()) withContent++;
    if (parentId.trim()) {
      withParentId++;
      parentIds.add(parentId.trim());
    }
    
    if (samples.length < 3 && noteContent.trim()) {
      samples.push({
        recordId: fields[colIdx['Record Id']],
        parentId: parentId.trim(),
        parentIdField: fields[colIdx['Parent ID']] || '',
        createdTime,
        noteTitle,
        contentLen: noteContent.length,
        contentSample: noteContent.substring(0, 150)
      });
    }
  }
  
  console.log('Total rows:', total);
  console.log('With Note Content:', withContent);
  console.log('With Parent ID:', withParentId);
  console.log('Unique parent records:', parentIds.size);
  console.log('Sample parent IDs:', [...parentIds].slice(0, 5));
  console.log('Samples:', JSON.stringify(samples, null, 2));
}

analyzeFile(
  'c:/Users/User/Downloads/Notes_Contacts_2026_02_10_WS_Notes/Notes_Contacts_2026_02_10.csv',
  'CONTACTS NOTES'
);

analyzeFile(
  'c:/Users/User/Downloads/Notes_Leads_2026_02_10_WS_Notes/Notes_Leads_2026_02_10.csv',
  'LEADS NOTES'
);
