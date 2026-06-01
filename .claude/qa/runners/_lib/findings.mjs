// Shared helpers for QA runners.
// All runners produce the same finding shape, computed the same way.

import { createHash } from 'node:crypto';

/**
 * Compute a stable finding ID from category + location + canonical title.
 * Same root cause across runs always produces the same ID, so qa-judge can dedupe.
 */
export function findingId(category, location, title) {
  const canonical = `${category}::${(location || '').toLowerCase()}::${(title || '').toLowerCase().replace(/\d+/g, 'N')}`;
  return createHash('sha1').update(canonical).digest('hex').slice(0, 12);
}

/**
 * Construct a finding with required defaults.
 * Specialists may propose severity/confidence; the judge re-classifies.
 */
export function finding({
  category,
  severity = 'P2',
  confidence = 0.7,
  title,
  what_broken = title,
  location,
  evidence = [],
  suggested_fix = '',
}) {
  return {
    id: findingId(category, location, title),
    severity,
    confidence,
    title,
    what_broken,
    category,
    location,
    evidence,
    suggested_fix,
  };
}

/**
 * Build the standard raw output envelope every specialist writes.
 */
export function specialistOutput({ specialist, tier, findings, coverage = {}, errors = [], writesPerformed = 0, startedAt }) {
  return {
    specialist,
    started_at: startedAt || new Date().toISOString(),
    finished_at: new Date().toISOString(),
    tier,
    writes_performed: writesPerformed,
    findings,
    coverage,
    errors,
  };
}

/**
 * Parse CLI args of the form --key=value into an object.
 */
export function parseArgs(argv) {
  return Object.fromEntries(
    argv.slice(2)
      .filter(a => a.startsWith('--'))
      .map(a => {
        const [k, ...rest] = a.replace(/^--/, '').split('=');
        return [k, rest.join('=') || true];
      })
  );
}

/**
 * Load JSON file or exit with a clear error.
 */
export async function loadJson(path, label) {
  const { readFile } = await import('node:fs/promises');
  try {
    const txt = await readFile(path, 'utf8');
    return JSON.parse(txt);
  } catch (err) {
    process.stderr.write(`✗ Failed to load ${label} from ${path}: ${err.message}\n`);
    process.exit(2);
  }
}

/**
 * Write the output JSON (to --out file or stdout) and exit.
 */
export async function writeOutput(output, outPath) {
  const { writeFile, mkdir } = await import('node:fs/promises');
  const { dirname } = await import('node:path');
  const json = JSON.stringify(output, null, 2);
  if (outPath) {
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, json);
  } else {
    process.stdout.write(json + '\n');
  }
}

/**
 * Production safety gate. Throws if config says production mode.
 * Every runner calls this before doing anything.
 */
export function refuseIfProduction(config) {
  const mode = config?.supabase?.mode;
  const blockedModes = config?._safety?.refuse_if_supabase_mode_is || ['production', 'prod'];
  if (blockedModes.includes(mode)) {
    throw new Error(`Refusing to run: config.supabase.mode = "${mode}". This kit never runs against production.`);
  }
  const blockedUrls = config?._safety?.production_urls_blocklist || [];
  const allUrls = [
    ...(config?.apps || []).map(a => a.dev_url).filter(Boolean),
    ...(config?.apps || []).map(a => a.preview_url).filter(Boolean),
  ];
  for (const url of allUrls) {
    for (const blocked of blockedUrls) {
      if (url.includes(blocked)) {
        throw new Error(`Refusing to run: URL "${url}" matches production_urls_blocklist entry "${blocked}".`);
      }
    }
  }
}

/**
 * Check the kill switch file. Returns true if a PAUSE file exists.
 */
export async function paused(repoRoot = process.cwd()) {
  const { access } = await import('node:fs/promises');
  try {
    await access(`${repoRoot}/.claude/qa/PAUSE`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Unique marker for test data injection: qa-{ISO8601}-{random6}
 */
export function marker(prefix = 'qa') {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${ts}-${rand}`;
}
