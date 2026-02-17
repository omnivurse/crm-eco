const fs = require('fs');

const content = fs.readFileSync('c:/Users/User/Desktop/Contacts_2026_02_10_ALL/Contacts_2026_02_10.csv', 'utf-8');
const lines = content.split('\n');

// Parse header
const header = lines[0];
const headerCols = parseCSVLine(header);
const nhIdx = headerCols.indexOf('Notes History');
const ridIdx = headerCols.indexOf('Record Id');
const emailIdx = headerCols.indexOf('Email');
const nameIdx = headerCols.indexOf('Contact Name');

console.log('Notes History idx:', nhIdx);
console.log('Record Id idx:', ridIdx);
console.log('Email idx:', emailIdx);
console.log('Total cols:', headerCols.length);

let withNotes = 0;
let total = 0;
const samples = [];

for (let i = 1; i < lines.length; i++) {
  if (!lines[i].trim()) continue;
  total++;
  const fields = parseCSVLine(lines[i]);
  const nh = fields[nhIdx] || '';
  if (nh.trim()) {
    withNotes++;
    if (samples.length < 3) {
      samples.push({
        recordId: fields[ridIdx],
        email: fields[emailIdx],
        name: fields[nameIdx],
        notesLen: nh.length,
        notesSample: nh.substring(0, 100)
      });
    }
  }
}

console.log('Total data rows:', total);
console.log('Rows with Notes History:', withNotes);
console.log('Samples:', JSON.stringify(samples, null, 2));

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
  fields.push(field);
  return fields;
}
