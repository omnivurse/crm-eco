import fs from 'node:fs';
import path from 'node:path';
import * as Phosphor from '@phosphor-icons/react';
import { createRequire } from 'node:module';

// Load MAP by evaluating the admin script's MAP object via regex extract — simpler: re-run list + MAP check
const script = fs.readFileSync('scripts/lucide-to-phosphor-admin.mjs', 'utf8');
const mapMatch = script.match(/const MAP = \{([\s\S]*?)\n\};/);
if (!mapMatch) throw new Error('MAP not found');
// eslint-disable-next-line no-new-func
const MAP = Function(`return {${mapMatch[1]}}`)();

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(ent.name)) out.push(p);
  }
  return out;
}

const used = new Set();
for (const f of walk('apps/admin/src')) {
  const src = fs.readFileSync(f, 'utf8');
  if (!src.includes('lucide-react')) continue;
  for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/gs)) {
    for (const part of m[1].split(',')) {
      let t = part.trim().replace(/^type\s+/, '');
      if (!t || t === 'LucideIcon') continue;
      used.add(t.split(/\s+as\s+/)[0].trim());
    }
  }
}

const missing = [];
for (const lucide of used) {
  const ph = MAP[lucide];
  if (!ph) {
    missing.push(`${lucide} → (unmapped)`);
    continue;
  }
  if (typeof Phosphor[ph] !== 'object' && typeof Phosphor[ph] !== 'function') {
    missing.push(`${lucide} → ${ph} (not in phosphor)`);
  }
}
if (missing.length) {
  console.log(missing.join('\n'));
  process.exit(1);
}
console.log('OK', used.size, 'icons map to valid Phosphor exports');
