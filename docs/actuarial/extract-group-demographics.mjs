/**
 * @fileoverview Extract group demographics from Zoho CSV, grouped by Producer/Group.
 * Run: node docs/actuarial/extract-group-demographics.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(__dirname, '..', 'EnrollFlow', 'Data', 'Contacts_2025_10_16.csv');
const OUTPUT_DIR = join(__dirname, 'output');

function parseCSV(raw) {
  const rows = [];
  let current = '';
  let inQuotes = false;
  const lines = raw.split('\n');
  for (const line of lines) {
    if (inQuotes) {
      current += '\n' + line;
      if ((line.match(/"/g) || []).length % 2 === 1) { inQuotes = false; rows.push(current); current = ''; }
    } else {
      if ((line.match(/"/g) || []).length % 2 === 1) { inQuotes = true; current = line; }
      else rows.push(line);
    }
  }
  return rows.filter(r => r.trim()).map(row => {
    const fields = []; let field = ''; let q = false;
    for (let i = 0; i < row.length; i++) {
      const c = row[i];
      if (c === '"') { q = !q; continue; }
      if (c === ',' && !q) { fields.push(field.trim()); field = ''; continue; }
      field += c;
    }
    fields.push(field.trim());
    return fields;
  });
}

function getAge(dobStr, refDate = '2026-02-19') {
  if (!dobStr || dobStr === '') return null;
  try {
    const d = new Date(dobStr);
    if (isNaN(d.getTime())) return null;
    const ref = new Date(refDate);
    let age = ref.getFullYear() - d.getFullYear();
    const m = ref.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && ref.getDate() < d.getDate())) age--;
    return age >= 0 && age < 120 ? age : null;
  } catch { return null; }
}

function parseMoney(str) {
  if (!str || str === '') return null;
  const n = parseFloat(str.replace(/[$,\s]/g, ''));
  return isNaN(n) ? null : n;
}

const raw = readFileSync(CSV_PATH, 'utf-8');
const rows = parseCSV(raw);
const headers = rows[0];
const data = rows.slice(1);

const col = {};
headers.forEach((h, i) => { col[h] = i; });

console.log(`Total rows: ${data.length}\n`);

// ── Parse all contacts ──
const contacts = data.map(row => {
  const producerRaw = (row[col['Producer Name']] || '').trim();
  const spouseName = (row[col['Spouse']] || '').trim();
  const spouseDob = (row[col['Spouse - DOB']] || '').trim();

  const children = [];
  for (let i = 1; i <= 5; i++) {
    const name = (row[col[`Child ${i}`]] || '').trim();
    const dobKey = i === 3 ? `Child 3 -DOB` : `Child ${i}-DOB`;
    if (i === 4) {
      const dob = (row[col['Child 4 -DOB']] || row[col['Child 4-DOB']] || '').trim();
      if (name) children.push({ name, dob, age: getAge(dob) });
    } else if (i === 5) {
      const dob = (row[col['Child 5 -DOB']] || row[col['Child 5-DOB']] || '').trim();
      if (name) children.push({ name, dob, age: getAge(dob) });
    } else {
      const dob = (row[col[dobKey]] || '').trim();
      if (name) children.push({ name, dob, age: getAge(dob) });
    }
  }

  const mecSubmitted = (row[col['MEC Submitted']] || '').trim();
  const mecConfirmed = (row[col['MEC Decision Confirmed']] || '').trim();
  let mecStatus = 'W/O MEC';
  if (mecConfirmed && mecConfirmed.toLowerCase() !== 'false' && mecConfirmed !== '') {
    mecStatus = 'W/ MEC';
  } else if (mecSubmitted && mecSubmitted.toLowerCase() !== 'false' && mecSubmitted !== '') {
    mecStatus = 'MEC Submitted';
  }

  return {
    producer: producerRaw,
    contactName: (row[col['Contact Name']] || '').trim(),
    firstName: (row[col['First Name']] || '').trim(),
    lastName: (row[col['Last Name']] || '').trim(),
    status: (row[col['Contact Status']] || '').trim(),
    product: (row[col['Product']] || '').trim(),
    monthlyPremium: parseMoney(row[col['Monthly Premium']] || ''),
    iua: parseMoney(row[col['IUA Amount']] || ''),
    mecStatus,
    startDate: (row[col['Start Date']] || '').trim(),
    cancelDate: (row[col['Cancellation Date']] || '').trim(),
    state: (row[col['Mailing State']] || '').trim(),
    gender: (row[col['Primary Member Gender']] || '').trim(),
    dob: (row[col['Date of Birth']] || '').trim(),
    age: getAge((row[col['Date of Birth']] || '').trim()),
    hasSpouse: spouseName !== '',
    spouseAge: getAge(spouseDob),
    childCount: children.length,
    childAges: children.map(c => c.age).filter(a => a !== null),
    coverageOption: (row[col['Coverage Option']] || '').trim(),
    company: (row[col['Company/Association']] || '').trim(),
  };
});

// ── Group by Producer Name ──
const groups = {};
contacts.forEach(c => {
  const key = c.producer || '(No Producer)';
  if (!groups[key]) groups[key] = [];
  groups[key].push(c);
});

const groupsSorted = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);

console.log('=== PRODUCER / GROUP DISTRIBUTION (Top 30) ===');
console.log(`Total unique producers: ${groupsSorted.length}\n`);
groupsSorted.slice(0, 30).forEach(([name, members], i) => {
  const active = members.filter(m => m.status === 'Active HS Member').length;
  console.log(`  ${(i + 1).toString().padStart(2)}. ${name.padEnd(55)} Total: ${members.length.toString().padStart(4)}  Active: ${active.toString().padStart(4)}`);
});

const otherCount = groupsSorted.slice(30).reduce((s, [, m]) => s + m.length, 0);
if (groupsSorted.length > 30) {
  console.log(`\n  ... plus ${groupsSorted.length - 30} more producers with ${otherCount} total members`);
}

// ── Generate CSV output with group demographics ──
const csvHeaders = [
  'Group (Producer)',
  'Contact Name',
  'Status',
  'Product (Membership Name)',
  'Monthly Amount',
  'IUA',
  'MEC Status',
  'Start Date',
  'End Date',
  'State',
  'Gender',
  'Member Age',
  'Has Spouse',
  'Spouse Age',
  'Number of Children',
  'Child Ages',
  'Coverage Option',
  'Company/Association',
];

const csvRows = [];
groupsSorted.forEach(([producer, members]) => {
  members.forEach(m => {
    csvRows.push([
      `"${producer.replace(/"/g, '""')}"`,
      `"${m.contactName.replace(/"/g, '""')}"`,
      `"${m.status}"`,
      `"${m.product}"`,
      m.monthlyPremium !== null ? m.monthlyPremium.toFixed(2) : '',
      m.iua !== null ? m.iua.toFixed(2) : '',
      `"${m.mecStatus}"`,
      `"${m.startDate}"`,
      `"${m.cancelDate}"`,
      `"${m.state}"`,
      `"${m.gender}"`,
      m.age !== null ? m.age : '',
      m.hasSpouse ? 'Yes' : 'No',
      m.spouseAge !== null ? m.spouseAge : '',
      m.childCount,
      `"${m.childAges.join(', ')}"`,
      `"${m.coverageOption}"`,
      `"${m.company.replace(/"/g, '""')}"`,
    ].join(','));
  });
});

const csvContent = csvHeaders.join(',') + '\n' + csvRows.join('\n');
const csvPath = join(OUTPUT_DIR, 'DHH_Group_Demographics_By_Producer.csv');
writeFileSync(csvPath, csvContent);
console.log(`\n\nCSV written to: ${csvPath}`);
console.log(`Total rows: ${csvRows.length}`);

// ── Group summary stats ──
console.log('\n\n=== GROUP SUMMARY (Top 15 by Active Members) ===\n');
const summaryHeaders = 'Group | Total | Active | Avg Premium | States | Avg Age | W/ Spouse | W/ Kids';
console.log(summaryHeaders);
console.log('-'.repeat(120));

groupsSorted
  .map(([name, members]) => ({
    name,
    members,
    active: members.filter(m => m.status === 'Active HS Member').length,
  }))
  .sort((a, b) => b.active - a.active)
  .slice(0, 15)
  .forEach(({ name, members, active }) => {
    const withPremium = members.filter(m => m.monthlyPremium !== null && m.monthlyPremium > 0);
    const avgPrem = withPremium.length > 0 ? (withPremium.reduce((s, m) => s + m.monthlyPremium, 0) / withPremium.length).toFixed(0) : '—';
    const states = [...new Set(members.map(m => m.state).filter(Boolean))];
    const withAge = members.filter(m => m.age !== null);
    const avgAge = withAge.length > 0 ? (withAge.reduce((s, m) => s + m.age, 0) / withAge.length).toFixed(1) : '—';
    const withSpouse = members.filter(m => m.hasSpouse).length;
    const withKids = members.filter(m => m.childCount > 0).length;

    console.log(
      `${name.substring(0, 50).padEnd(50)} | ${String(members.length).padStart(5)} | ${String(active).padStart(6)} | $${String(avgPrem).padStart(6)} | ${states.join(', ').substring(0, 12).padEnd(12)} | ${String(avgAge).padStart(5)} | ${String(withSpouse).padStart(9)} | ${String(withKids).padStart(7)}`
    );
  });

console.log('\nDone.');
