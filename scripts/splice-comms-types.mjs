#!/usr/bin/env node
/**
 * Splice live comms-foundation table types into packages/lib/src/types/database.ts.
 * Source: MCP generate_typescript_types dump (JSON { types: "..." }).
 */
import fs from 'node:fs';

const GENERATED = process.argv[2];
const TARGET = process.argv[3];
if (!GENERATED || !TARGET) {
  console.error('Usage: node splice-comms-types.mjs <generated.json> <database.ts>');
  process.exit(1);
}

const parsed = JSON.parse(fs.readFileSync(GENERATED, 'utf8'));
const src = parsed.types;
if (!src || typeof src !== 'string') {
  console.error('generated file missing .types string');
  process.exit(1);
}

function extractTable(source, name) {
  const needle = `      ${name}: {`;
  const start = source.indexOf(needle);
  if (start < 0) throw new Error(`missing table ${name} in generated types`);
  let i = start + needle.length;
  let depth = 1;
  while (i < source.length && depth > 0) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;
    i += 1;
  }
  return source.slice(start, i);
}

const INSERTS = [
  { before: '      contact_submissions: {', tables: ['comms_dead_letters', 'comms_sync_cursors', 'communication_record_links'] },
  { before: '      email_sequence_enrollments: {', tables: ['email_send_outbox'] },
  { before: '      inbox_messages: {', tables: ['inbox_internal_notes'] },
  { before: '      memberships: {', tables: ['message_participants'] },
  { before: '      provider_locations: {', tables: ['provider_inbound_events'] },
];

let dest = fs.readFileSync(TARGET, 'utf8');

for (const { before, tables } of INSERTS) {
  if (!dest.includes(before)) {
    throw new Error(`anchor not found: ${before}`);
  }
  const already = tables.filter((t) => dest.includes(`      ${t}: {`));
  if (already.length === tables.length) {
    console.log(`skip ${tables.join(', ')} (already present)`);
    continue;
  }
  const blocks = tables
    .filter((t) => !dest.includes(`      ${t}: {`))
    .map((t) => extractTable(src, t))
    .join('\n');
  dest = dest.replace(before, `${blocks}\n${before}`);
  console.log(`inserted ${tables.join(', ')}`);
}

fs.writeFileSync(TARGET, dest);
console.log('wrote', TARGET);
