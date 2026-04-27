#!/usr/bin/env node
/**
 * codemod-tenant-resolver.mjs
 * --------------------------------------------------------------
 * Replace the legacy "look up profile.organization_id from supabase"
 * pattern with the active-tenant resolver in `apps/admin`.
 *
 * Idempotent: rerunning is a no-op once a file is migrated.
 *
 * Patterns rewritten:
 *
 *   const { data: { user } } = await supabase.auth.getUser();
 *   if (!user) return ...;          (left intact when followed by another
 *                                    user use beyond the profile lookup)
 *
 *   const { data: profile } = await supabase
 *     .from('profiles')
 *     .select('...organization_id...')
 *     .eq('user_id', user.id)
 *     .single() [as ...];
 *
 *   if (!profile) return ...;       → replaced with:
 *
 *   const tenant = await getActiveTenant();
 *   if (!tenant) return ...;
 *
 *   profile.organization_id  →  tenant.organizationId
 *   profile?.organization_id →  tenant.organizationId
 *
 * Adds the `import { getActiveTenant } from '@/lib/tenant';` import.
 *
 * Usage:
 *   node scripts/codemod-tenant-resolver.mjs            # dry-run
 *   node scripts/codemod-tenant-resolver.mjs --write    # apply
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), 'apps/admin/src');
const WRITE = process.argv.includes('--write');

/** Recursively collect .ts/.tsx files under ROOT. */
function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full);
    if (/\.(t|j)sx?$/.test(e.name)) return [full];
    return [];
  });
}

/**
 * Match the canonical "fetch profile.organization_id from supabase"
 * block. Tolerates whitespace and a few common shapes:
 *   .select('organization_id')
 *   .select('organization_id, role')
 *   .select('id, organization_id, role')
 * with optional `as { data: ... }` casts.
 */
const PROFILE_BLOCK_RE =
  /\n[ \t]*const\s*\{\s*data:\s*profile(?:Data)?\s*\}\s*=\s*await\s*supabase\s*\.\s*from\(\s*['"]profiles['"]\s*\)\s*\.\s*select\(\s*['"][^'"]*organization_id[^'"]*['"]\s*\)\s*\.\s*eq\(\s*['"]user_id['"]\s*,\s*user\??\.id\s*\)\s*\.\s*single\(\s*\)(?:\s*as\s*\{[\s\S]*?\})?\s*;?\s*\n/g;

/** Match an `if (!profile|profileData) return ...;` line directly after. */
const PROFILE_GUARD_RE =
  /^([ \t]*)if\s*\(\s*!\s*profile(?:Data)?\s*\)\s*(?:return\s*[\s\S]*?;|\{[\s\S]*?\})\s*\n/m;

/** The auth.getUser block that often precedes the profile lookup. */
const AUTH_USER_RE =
  /\n([ \t]*)const\s*\{\s*data:\s*\{\s*user\s*\}\s*,?\s*\}\s*=\s*await\s*supabase\.auth\.getUser\(\)\s*;\s*\n[ \t]*if\s*\(\s*!\s*user\s*\)\s*(?:return\s*[\s\S]*?;|\{[\s\S]*?\})\s*\n/g;

const IMPORT_LINE = "import { getActiveTenant } from '@/lib/tenant';\n";

function ensureImport(src) {
  if (src.includes("from '@/lib/tenant'")) return src;
  if (src.includes("from \"@/lib/tenant\"")) return src;

  // Place after the last existing import.
  const lines = src.split('\n');
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*import\b/.test(lines[i])) lastImport = i;
  }
  if (lastImport === -1) return IMPORT_LINE + src;
  lines.splice(lastImport + 1, 0, IMPORT_LINE.trim());
  return lines.join('\n');
}

function migrateFile(file) {
  const original = fs.readFileSync(file, 'utf8');
  let src = original;

  // Skip client components — `getActiveTenant()` is server-only.
  // These talk to Supabase via the browser client and rely on RLS.
  if (/^\s*['"]use client['"]/.test(original)) return null;

  if (!PROFILE_BLOCK_RE.test(src)) return null;
  // Reset regex state.
  PROFILE_BLOCK_RE.lastIndex = 0;

  // Replace the profile fetch block(s).
  src = src.replace(PROFILE_BLOCK_RE, (block) => {
    // Indentation hint from the original block.
    const indentMatch = block.match(/\n([ \t]*)const/);
    const indent = indentMatch ? indentMatch[1] : '  ';
    return `\n${indent}const tenant = await getActiveTenant();\n`;
  });

  // Replace the `if (!profile) return ...;` guard.
  // We only do this once to avoid double-replacement.
  src = src.replace(
    /(\n[ \t]*const tenant = await getActiveTenant\(\);\n)([ \t]*)if\s*\(\s*!\s*profile(?:Data)?\s*\)\s*(return\s*[\s\S]*?;|\{[\s\S]*?\})\s*\n/g,
    (_m, head, indent, ret) => `${head}${indent}if (!tenant) ${ret}\n`,
  );

  // Field references.
  src = src.replace(/\bprofileData\?\.organization_id\b/g, 'tenant.organizationId');
  src = src.replace(/\bprofileData\.organization_id\b/g, 'tenant.organizationId');
  src = src.replace(/\bprofile\?\.organization_id\b/g, 'tenant.organizationId');
  src = src.replace(/\bprofile\.organization_id\b/g, 'tenant.organizationId');

  // Drop the auth.getUser pre-block when the only remaining `user`
  // reference was the profile lookup we just removed. We detect that
  // by checking the post-replacement source — if `user.id` or `user)`
  // no longer appears, the block is dead.
  if (!/\buser\b/.test(src.replace(AUTH_USER_RE, ''))) {
    // No remaining usage — strip the block.
    src = src.replace(AUTH_USER_RE, '\n');
  }

  if (src === original) return null;

  src = ensureImport(src);

  return src;
}

const files = walk(ROOT);
const changed = [];
const skipped = [];

for (const file of files) {
  try {
    const next = migrateFile(file);
    if (next == null) continue;
    if (WRITE) fs.writeFileSync(file, next, 'utf8');
    changed.push(path.relative(process.cwd(), file));
  } catch (e) {
    skipped.push({ file: path.relative(process.cwd(), file), err: e.message });
  }
}

console.log(`Files migrated: ${changed.length}`);
for (const f of changed) console.log(`  • ${f}`);
if (skipped.length) {
  console.log(`Errors: ${skipped.length}`);
  for (const { file, err } of skipped) console.log(`  • ${file}: ${err}`);
}
if (!WRITE) console.log('\n(dry-run; pass --write to apply)');
