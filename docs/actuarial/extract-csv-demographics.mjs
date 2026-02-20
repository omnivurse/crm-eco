/**
 * @fileoverview Extract de-identified aggregate demographics from Zoho contacts CSV.
 * Outputs JSON with real aggregate data for the de-identification report.
 * Run: node docs/actuarial/extract-csv-demographics.mjs
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(__dirname, '..', 'EnrollFlow', 'Data', 'Contacts_2025_10_16.csv');

function parseCSV(raw) {
  const rows = [];
  let current = '';
  let inQuotes = false;
  const lines = raw.split('\n');

  for (const line of lines) {
    if (inQuotes) {
      current += '\n' + line;
      if ((line.match(/"/g) || []).length % 2 === 1) {
        inQuotes = false;
        rows.push(current);
        current = '';
      }
    } else {
      if ((line.match(/"/g) || []).length % 2 === 1) {
        inQuotes = true;
        current = line;
      } else {
        rows.push(line);
      }
    }
  }

  return rows.filter(r => r.trim()).map(row => {
    const fields = [];
    let field = '';
    let q = false;
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

function getAge(dobStr) {
  if (!dobStr || dobStr === '') return null;
  try {
    const d = new Date(dobStr);
    if (isNaN(d.getTime())) return null;
    const now = new Date('2026-02-19');
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
    return age >= 0 && age < 120 ? age : null;
  } catch { return null; }
}

function ageBand(age) {
  if (age === null) return null;
  if (age <= 17) return '0-17';
  if (age <= 25) return '18-25';
  if (age <= 35) return '26-35';
  if (age <= 45) return '36-45';
  if (age <= 55) return '46-55';
  if (age <= 64) return '56-64';
  return '65+';
}

function parseMoney(str) {
  if (!str || str === '') return null;
  const cleaned = str.replace(/[$,\s]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

const raw = readFileSync(CSV_PATH, 'utf-8');
const rows = parseCSV(raw);
const headers = rows[0];
const data = rows.slice(1);

const colIdx = {};
headers.forEach((h, i) => { colIdx[h] = i; });

console.log(`Total CSV rows: ${data.length}`);
console.log(`Headers: ${headers.length} columns\n`);

const contacts = data.map(row => ({
  status: (row[colIdx['Contact Status']] || '').trim(),
  dob: (row[colIdx['Date of Birth']] || '').trim(),
  state: (row[colIdx['Mailing State']] || '').trim(),
  product: (row[colIdx['Product']] || '').trim(),
  coverage: (row[colIdx['Coverage Option']] || '').trim(),
  gender: (row[colIdx['Primary Member Gender']] || '').trim(),
  monthlyPremium: parseMoney(row[colIdx['Monthly Premium']] || ''),
  iua: parseMoney(row[colIdx['IUA Amount']] || ''),
  startDate: (row[colIdx['Start Date']] || '').trim(),
  cancelDate: (row[colIdx['Cancellation Date']] || '').trim(),
}));

// ── STATUS DISTRIBUTION ──
const statusCounts = {};
contacts.forEach(c => {
  const s = c.status || '(blank)';
  statusCounts[s] = (statusCounts[s] || 0) + 1;
});
console.log('=== CONTACT STATUS DISTRIBUTION ===');
Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
  console.log(`  ${k}: ${v} (${(v / contacts.length * 100).toFixed(1)}%)`);
});

const total = contacts.length;

// ── PRODUCT DISTRIBUTION ──
const productCounts = {};
contacts.forEach(c => {
  const p = c.product || '(blank)';
  productCounts[p] = (productCounts[p] || 0) + 1;
});
console.log('\n=== PRODUCT (PLAN) DISTRIBUTION ===');
Object.entries(productCounts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
  console.log(`  ${k}: ${v} (${(v / total * 100).toFixed(1)}%)`);
});

// ── COVERAGE OPTION DISTRIBUTION ──
const coverageCounts = {};
contacts.forEach(c => {
  const cv = c.coverage || '(blank)';
  coverageCounts[cv] = (coverageCounts[cv] || 0) + 1;
});
console.log('\n=== COVERAGE OPTION DISTRIBUTION ===');
Object.entries(coverageCounts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
  console.log(`  ${k}: ${v} (${(v / total * 100).toFixed(1)}%)`);
});

// ── GENDER DISTRIBUTION ──
const genderCounts = {};
contacts.forEach(c => {
  const g = c.gender || '(blank)';
  genderCounts[g] = (genderCounts[g] || 0) + 1;
});
console.log('\n=== GENDER DISTRIBUTION ===');
Object.entries(genderCounts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
  console.log(`  ${k}: ${v} (${(v / total * 100).toFixed(1)}%)`);
});

// ── AGE DISTRIBUTION ──
const ageBandCounts = {};
let ageKnown = 0;
contacts.forEach(c => {
  const age = getAge(c.dob);
  if (age !== null) {
    ageKnown++;
    const band = ageBand(age);
    ageBandCounts[band] = (ageBandCounts[band] || 0) + 1;
  }
});
const ageBandOrder = ['0-17', '18-25', '26-35', '36-45', '46-55', '56-64', '65+'];
console.log(`\n=== AGE DISTRIBUTION (${ageKnown} with known DOB out of ${total}) ===`);
ageBandOrder.forEach(band => {
  const v = ageBandCounts[band] || 0;
  console.log(`  ${band}: ${v} (${ageKnown > 0 ? (v / ageKnown * 100).toFixed(1) : 0}%)`);
});

// ── STATE DISTRIBUTION (top 15) ──
const stateCounts = {};
contacts.forEach(c => {
  const st = c.state || '(blank)';
  if (st && st !== '(blank)') {
    stateCounts[st] = (stateCounts[st] || 0) + 1;
  }
});
const statesSorted = Object.entries(stateCounts).sort((a, b) => b[1] - a[1]);
const statesWithData = statesSorted.reduce((sum, [, v]) => sum + v, 0);
console.log(`\n=== STATE DISTRIBUTION — Top 15 (${statesWithData} with state data) ===`);
statesSorted.slice(0, 15).forEach(([k, v]) => {
  console.log(`  ${k}: ${v} (${(v / statesWithData * 100).toFixed(1)}%)`);
});
const otherStates = statesSorted.slice(15);
if (otherStates.length > 0) {
  const otherCount = otherStates.reduce((sum, [, v]) => sum + v, 0);
  console.log(`  Other (${otherStates.length} states): ${otherCount} (${(otherCount / statesWithData * 100).toFixed(1)}%)`);
}
console.log(`  Total states represented: ${statesSorted.length}`);

// ── MONTHLY PREMIUM DISTRIBUTION ──
const premiums = contacts.filter(c => c.monthlyPremium !== null && c.monthlyPremium > 0).map(c => c.monthlyPremium);
premiums.sort((a, b) => a - b);
console.log(`\n=== MONTHLY PREMIUM STATS (${premiums.length} contacts with premium data) ===`);
if (premiums.length > 0) {
  const sum = premiums.reduce((a, b) => a + b, 0);
  console.log(`  Min: $${premiums[0].toFixed(2)}`);
  console.log(`  Max: $${premiums[premiums.length - 1].toFixed(2)}`);
  console.log(`  Mean: $${(sum / premiums.length).toFixed(2)}`);
  console.log(`  Median: $${premiums[Math.floor(premiums.length / 2)].toFixed(2)}`);
}

// ── MONTHLY PREMIUM BY AGE BAND ──
const premByAge = {};
contacts.forEach(c => {
  const age = getAge(c.dob);
  if (age !== null && c.monthlyPremium !== null && c.monthlyPremium > 0) {
    const band = ageBand(age);
    if (!premByAge[band]) premByAge[band] = [];
    premByAge[band].push(c.monthlyPremium);
  }
});
console.log('\n=== MONTHLY PREMIUM BY AGE BAND ===');
ageBandOrder.forEach(band => {
  const vals = premByAge[band] || [];
  if (vals.length > 0) {
    const sum = vals.reduce((a, b) => a + b, 0);
    vals.sort((a, b) => a - b);
    console.log(`  ${band}: n=${vals.length}, avg=$${(sum / vals.length).toFixed(2)}, median=$${vals[Math.floor(vals.length / 2)].toFixed(2)}, min=$${vals[0].toFixed(2)}, max=$${vals[vals.length - 1].toFixed(2)}`);
  } else {
    console.log(`  ${band}: no data`);
  }
});

// ── MONTHLY PREMIUM BY PRODUCT ──
const premByProduct = {};
contacts.forEach(c => {
  if (c.monthlyPremium !== null && c.monthlyPremium > 0 && c.product) {
    if (!premByProduct[c.product]) premByProduct[c.product] = [];
    premByProduct[c.product].push(c.monthlyPremium);
  }
});
console.log('\n=== MONTHLY PREMIUM BY PRODUCT ===');
Object.entries(premByProduct).sort((a, b) => b[1].length - a[1].length).forEach(([prod, vals]) => {
  const sum = vals.reduce((a, b) => a + b, 0);
  vals.sort((a, b) => a - b);
  console.log(`  ${prod}: n=${vals.length}, avg=$${(sum / vals.length).toFixed(2)}, median=$${vals[Math.floor(vals.length / 2)].toFixed(2)}, min=$${vals[0].toFixed(2)}, max=$${vals[vals.length - 1].toFixed(2)}`);
});

// ── MONTHLY PREMIUM BY AGE BAND + PRODUCT (cross-tab) ──
const premCross = {};
contacts.forEach(c => {
  const age = getAge(c.dob);
  if (age !== null && c.monthlyPremium !== null && c.monthlyPremium > 0 && c.product) {
    const band = ageBand(age);
    const key = `${band}|${c.product}`;
    if (!premCross[key]) premCross[key] = [];
    premCross[key].push(c.monthlyPremium);
  }
});
const products = Object.keys(productCounts).filter(p => p !== '(blank)').sort();
console.log('\n=== MONTHLY PREMIUM BY AGE BAND × PRODUCT (avg) ===');
console.log(`  ${'Age Band'.padEnd(10)}${products.map(p => p.padEnd(20)).join('')}`);
ageBandOrder.forEach(band => {
  const parts = [band.padEnd(10)];
  products.forEach(p => {
    const vals = premCross[`${band}|${p}`] || [];
    if (vals.length > 0) {
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      parts.push(`$${avg.toFixed(0)} (n=${vals.length})`.padEnd(20));
    } else {
      parts.push('—'.padEnd(20));
    }
  });
  console.log(`  ${parts.join('')}`);
});

// ── IUA DISTRIBUTION ──
const iuaCounts = {};
contacts.forEach(c => {
  if (c.iua !== null && c.iua > 0) {
    const iuaStr = `$${c.iua.toFixed(0)}`;
    iuaCounts[iuaStr] = (iuaCounts[iuaStr] || 0) + 1;
  }
});
console.log('\n=== IUA DISTRIBUTION ===');
Object.entries(iuaCounts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
  console.log(`  ${k}: ${v}`);
});

console.log('\n=== SUMMARY ===');
console.log(`  Total contacts in CSV: ${total}`);
console.log(`  With DOB: ${ageKnown}`);
console.log(`  With state: ${statesWithData}`);
console.log(`  With premium: ${premiums.length}`);
console.log(`  Unique states: ${statesSorted.length}`);
console.log(`  Unique products: ${Object.keys(productCounts).length}`);
