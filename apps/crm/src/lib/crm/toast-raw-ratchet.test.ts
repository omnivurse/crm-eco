/**
 * FB-2 — raw-toast ratchet (decision D9: "the vitest ratchet is the
 * load-bearing guard").
 *
 * The ESLint rule (`crm-toast/no-raw-toast-copy` in eslint.config.mjs) only
 * sees the call site's first argument, so it is trivially bypassed:
 *
 *     const msg = 'Saved!';
 *     toast.success(msg);          // rule silent, copy still hand-written
 *
 * …and it is only an *error* on the walked paths (warn elsewhere) until the
 * owner-gated FB-10 codemod lands. This test is the guard that actually holds
 * the line: it counts raw `toast.*('…')` sites per directory and fails when any
 * directory's count goes UP against the committed baseline. Counts going DOWN
 * is the point — the test tells you to refresh the baseline so the win sticks.
 *
 *     npm run toast:ratchet:update    # rewrite the baseline after a migration
 *
 * Scanning lives here rather than in a helper module so the update path runs the
 * exact same code the assertion runs (the update script is this file with
 * TOAST_RATCHET_UPDATE=1).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const APP_DIR = path.resolve(__dirname, '..', '..', '..');
const SRC_DIR = path.join(APP_DIR, 'src');
const BASELINE_PATH = path.join(__dirname, 'toast-raw-ratchet.baseline.json');
const UPDATING = process.env.TOAST_RATCHET_UPDATE === '1';

/**
 * `toast.success('…')`, `toast?.error(`…`)` — a string or template first
 * argument is copy typed at the call site. Mirrors the ESLint rule's methods.
 */
const RAW_TOAST_RE = /\btoast\s*\??\.\s*(?:success|error|info|warning|loading)\s*\(\s*['"`]/g;

/** Files whose whole job is to hold the copy — mirrors TOAST_COPY_SOURCES in eslint.config.mjs. */
const ALLOWED_FILES = new Set([
  'src/lib/crm/toast-copy.ts',
  'src/lib/crm/undo-delete.ts',
  'src/lib/crm/list-empty-state.ts',
]);

/**
 * Drop comment-only lines so a doc example (`* toast.success('Note added')`)
 * never inflates a directory's count.
 */
export function stripCommentLines(source: string): string {
  return source
    .split('\n')
    .filter((line) => {
      const t = line.trimStart();
      return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'));
    })
    .join('\n');
}

/** How many hand-written toast strings this source contains. */
export function countRawToastSites(source: string): number {
  const matches = stripCommentLines(source).match(RAW_TOAST_RE);
  return matches ? matches.length : 0;
}

function listSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) listSourceFiles(abs, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(abs);
  }
  return out;
}

/** Raw-toast site count per directory (keys relative to apps/crm, posix, sorted). */
export function scanRawToastSites(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const abs of listSourceFiles(SRC_DIR)) {
    const rel = path.relative(APP_DIR, abs).split(path.sep).join('/');
    if (ALLOWED_FILES.has(rel)) continue;
    const n = countRawToastSites(fs.readFileSync(abs, 'utf8'));
    if (n === 0) continue;
    const dir = rel.slice(0, rel.lastIndexOf('/'));
    counts[dir] = (counts[dir] ?? 0) + n;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

type Baseline = { total: number; byDir: Record<string, number> };

function readBaseline(): Baseline {
  return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')) as Baseline;
}

function writeBaseline(byDir: Record<string, number>): void {
  const total = Object.values(byDir).reduce((a, b) => a + b, 0);
  fs.writeFileSync(BASELINE_PATH, `${JSON.stringify({ total, byDir }, null, 2)}\n`, 'utf8');
}

describe('raw toast site detection', () => {
  it('counts string and template first arguments', () => {
    expect(countRawToastSites(`toast.success('Note added')`)).toBe(1);
    expect(countRawToastSites('toast.error(`Could not save ${name}`)')).toBe(1);
    expect(countRawToastSites(`toast.info("x"); toast.warning('y'); toast.loading('z')`)).toBe(3);
    expect(countRawToastSites(`toast?.success('Note added')`)).toBe(1);
  });

  it('ignores calls whose copy comes from a helper', () => {
    expect(countRawToastSites(`toast.success(toastCopy.added('Note'))`)).toBe(0);
    expect(countRawToastSites('toast.error(message)')).toBe(0);
    expect(countRawToastSites(`toast.custom('x')`)).toBe(0);
  });

  it('ignores commented-out and doc-comment examples', () => {
    expect(countRawToastSites(`// toast.success('Note added')`)).toBe(0);
    expect(countRawToastSites(` * toast.error('Not authenticated')`)).toBe(0);
    expect(stripCommentLines("/* toast.info('x') */\ntoast.info('y')")).toBe(`toast.info('y')`);
  });
});

describe('raw toast ratchet', () => {
  it('no directory has more raw toast copy than the committed baseline', () => {
    const current = scanRawToastSites();
    if (UPDATING) {
      writeBaseline(current);
      return;
    }
    const baseline = readBaseline();
    const risen = Object.entries(current)
      .filter(([dir, n]) => n > (baseline.byDir[dir] ?? 0))
      .map(([dir, n]) => `${dir}: ${baseline.byDir[dir] ?? 0} → ${n}`);
    expect(
      risen,
      `New hand-written toast copy. Use toastCopy.* from @/lib/crm/toast-copy, or run "npm run toast:ratchet:update" if the rise is intentional.\n${risen.join('\n')}`,
    ).toEqual([]);
  });

  it('reports the wins so the baseline stays honest', () => {
    if (UPDATING) return;
    const current = scanRawToastSites();
    const baseline = readBaseline();
    const stale = Object.entries(baseline.byDir)
      .filter(([dir, n]) => n > (current[dir] ?? 0))
      .map(([dir, n]) => `${dir}: ${n} → ${current[dir] ?? 0}`);
    expect(
      stale,
      `Raw toast copy went DOWN — lock the win in with "npm run toast:ratchet:update".\n${stale.join('\n')}`,
    ).toEqual([]);
  });

  it('keeps the baseline total in step with its directories', () => {
    if (UPDATING) return;
    const baseline = readBaseline();
    expect(Object.values(baseline.byDir).reduce((a, b) => a + b, 0)).toBe(baseline.total);
  });
});
