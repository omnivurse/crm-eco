#!/usr/bin/env node
/**
 * guard-proof.mjs — EV-GUARD: a recorded, re-runnable proof that the commit-time
 * toast-copy guard actually rejects new raw toast copy.
 *
 * The rest of the Road to Ten evidence is a Playwright row in `walk.json` that
 * anyone can re-open. A *commit-time* guard cannot be a Playwright row — there is
 * no browser in it — so this script is its equivalent: one command, one JSON
 * artifact, the same "re-open it yourself" standard.
 *
 *   npm run walk:crm:guard-proof            # from apps/crm
 *   node e2e/guard-proof.mjs --out-dir <dir>   # write into an existing walk run dir
 *   node e2e/guard-proof.mjs --keep-scratch    # debugging only; leaves the tree dirty
 *
 * What it proves, in order:
 *
 *   CONTROL   the ratchet is green on the tree as it stands (so a later red is
 *             caused by THIS script's scratch file, not by pre-existing debt).
 *   NEGATIVE  a scratch component under a WALKED glob whose toast copy comes from
 *             a variable is NOT flagged — the gate is not simply always-red.
 *   POSITIVE  the same file with a raw `toast.success('…')` string literal, staged
 *             and run through the REAL pre-commit path
 *             (`node --max-old-space-size=4096 apps/crm/e2e/lint-changed.mjs --staged`)
 *             exits non-zero and names `crm-toast/no-raw-toast-copy`.
 *   RATCHET   the vitest ratchet the pre-push hook runs goes red with the extra
 *             raw site present.
 *   CLEANUP   the scratch file is deleted, the index entry removed, and
 *             `git status --porcelain -uall` is byte-identical to the snapshot
 *             taken before any of it — asserted, not assumed, and run from a
 *             `finally` so a mid-flight throw still restores the tree.
 *
 * Git writes are limited to the index (`git add`, `git rm --cached`) on the single
 * scratch path. It never commits, stashes, resets, checks out or branches.
 *
 * Exit 0 only when every assertion above holds. Anything else prints FAIL and
 * exits 1 — a proof that cannot go red proves nothing.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const E2E_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(E2E_DIR, '..');
const REPO_ROOT = path.resolve(APP_DIR, '..', '..');
const WALK_ROOT = path.join(E2E_DIR, 'artifacts', 'crm-walk');

/** The rule the pre-commit path must name when it rejects the scratch commit. */
const RULE = 'crm-toast/no-raw-toast-copy';

/**
 * The scratch path sits under `**\/src/components/crm/records/**` — one of the
 * WALKED_PATHS globs in apps/crm/eslint.config.mjs, where the toast rule is an
 * ERROR rather than a warning. It is also under `src/`, so the vitest ratchet
 * counts it. One file exercises both guards.
 */
const SCRATCH_REL = 'apps/crm/src/components/crm/records/__guard_proof_scratch__.tsx';
const SCRATCH_ABS = path.join(REPO_ROOT, SCRATCH_REL);
const SCRATCH_DIR_KEY = 'src/components/crm/records';
const BASELINE_PATH = path.join(APP_DIR, 'src', 'lib', 'crm', 'toast-raw-ratchet.baseline.json');

/** Copy from a variable: the ESLint rule and the ratchet regex both stay silent. */
const SCRATCH_CONTROL = `'use client';
// Scratch file written by e2e/guard-proof.mjs. If you are reading this in a diff,
// the proof crashed between writing and deleting it — delete the file.
import { toast } from 'sonner';

const message = 'guard-proof control';

export default function GuardProofScratch() {
  return (
    <button type="button" onClick={() => toast.success(message)}>
      ok
    </button>
  );
}
`;

/** The same component with the copy typed at the call site — what the guard exists to reject. */
const SCRATCH_RAW = `'use client';
// Scratch file written by e2e/guard-proof.mjs. If you are reading this in a diff,
// the proof crashed between writing and deleting it — delete the file.
import { toast } from 'sonner';

export default function GuardProofScratch() {
  return (
    <button type="button" onClick={() => toast.success('guard-proof raw toast copy')}>
      ok
    </button>
  );
}
`;

const argv = process.argv.slice(2);
const flagValue = (name) => {
  const at = argv.indexOf(name);
  return at !== -1 && argv[at + 1] && !argv[at + 1].startsWith('--') ? argv[at + 1] : null;
};
const KEEP_SCRATCH = argv.includes('--keep-scratch');

function run(cmd, args, cwd) {
  const started = Date.now();
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' } });
  const output = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  return {
    command: [cmd, ...args].join(' '),
    cwd: path.relative(REPO_ROOT, cwd) || '.',
    exitCode: r.status === null ? -1 : r.status,
    ms: Date.now() - started,
    output,
  };
}

const git = (...args) => {
  const r = spawnSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${(r.stderr ?? '').trim()}`);
  return r.stdout ?? '';
};

/** Full working-tree status including untracked files — the byte string we must restore. */
const statusSnapshot = () => git('status', '--porcelain=v1', '--untracked-files=all', '-z');

function readBaseline() {
  const doc = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  return { total: doc.total, [SCRATCH_DIR_KEY]: doc.byDir?.[SCRATCH_DIR_KEY] ?? 0 };
}

/** The literal line .husky/pre-push runs, and the form that actually parses under vitest 4. */
const RATCHET_ARGS_HOOK = ['vitest', 'run', '--silent', 'src/lib/crm/toast-raw-ratchet.test.ts'];
const RATCHET_ARGS_OK = ['vitest', 'run', '--silent=true', 'src/lib/crm/toast-raw-ratchet.test.ts'];
const ratchet = (args) => run('npx', args, APP_DIR);
const lintStaged = () =>
  run('node', ['--max-old-space-size=4096', 'apps/crm/e2e/lint-changed.mjs', '--staged', SCRATCH_ABS], REPO_ROOT);

function writeScratch(contents) {
  fs.writeFileSync(SCRATCH_ABS, contents, 'utf8');
  git('add', '--', SCRATCH_REL);
}

function removeScratch() {
  // Index-only removal; --ignore-unmatch so a re-run after a crash is idempotent.
  spawnSync('git', ['rm', '--cached', '--force', '--quiet', '--ignore-unmatch', '--', SCRATCH_REL], { cwd: REPO_ROOT });
  if (fs.existsSync(SCRATCH_ABS)) fs.unlinkSync(SCRATCH_ABS);
}

const checks = [];
const check = (name, ok, detail) => {
  checks.push({ name, pass: Boolean(ok), detail });
  return Boolean(ok);
};

const commit = git('rev-parse', 'HEAD').trim();
const startedAt = new Date().toISOString();
const statusBefore = statusSnapshot();

if (fs.existsSync(SCRATCH_ABS)) {
  console.error(`guard-proof: ${SCRATCH_REL} already exists — a previous run crashed. Delete it and re-run.`);
  process.exit(2);
}

const baselineBefore = readBaseline();
let baselineAfter = null;
const steps = {};

// CONTROL — the ratchet must be green before we touch anything, otherwise a red
// later on proves nothing about the scratch file.
steps.ratchetControl = ratchet(RATCHET_ARGS_OK);
check('ratchet is green before the scratch file', steps.ratchetControl.exitCode === 0, `exit=${steps.ratchetControl.exitCode}`);

// The literal pre-push line, run on the same clean tree. If it is red HERE it is
// red always, which makes it a false alarm rather than a guard — recorded, and
// reported as a defect in .husky/pre-push rather than silently relied on.
steps.ratchetHookControl = ratchet(RATCHET_ARGS_HOOK);
const hookLineDiscriminating = steps.ratchetHookControl.exitCode === 0;

let statusAfter = null;
try {
  // NEGATIVE — copy from a variable: the gate must NOT name the rule.
  writeScratch(SCRATCH_CONTROL);
  steps.lintControl = lintStaged();
  check(
    'pre-commit path does NOT flag copy that comes from a variable',
    !steps.lintControl.output.includes(RULE),
    `exit=${steps.lintControl.exitCode}, rule named=${steps.lintControl.output.includes(RULE)}`,
  );

  // POSITIVE — the raw string literal, through the real pre-commit path.
  writeScratch(SCRATCH_RAW);
  steps.lintRaw = lintStaged();
  check('pre-commit path REJECTS a new raw toast', steps.lintRaw.exitCode !== 0, `exit=${steps.lintRaw.exitCode}`);
  check('rejection names the rule', steps.lintRaw.output.includes(RULE), `looking for "${RULE}"`);

  // RATCHET — the pre-push guard, with the extra raw site present.
  steps.ratchetRaw = ratchet(RATCHET_ARGS_OK);
  check('pre-push ratchet REJECTS the extra raw site', steps.ratchetRaw.exitCode !== 0, `exit=${steps.ratchetRaw.exitCode}`);
  check(
    'ratchet failure names the directory that rose',
    steps.ratchetRaw.output.includes(SCRATCH_DIR_KEY),
    `looking for "${SCRATCH_DIR_KEY}"`,
  );
  steps.ratchetHookRaw = ratchet(RATCHET_ARGS_HOOK);
} finally {
  if (!KEEP_SCRATCH) removeScratch();
  baselineAfter = readBaseline();
  statusAfter = statusSnapshot();
}

// CLEANUP — asserted, not assumed.
check('scratch file removed', KEEP_SCRATCH || !fs.existsSync(SCRATCH_ABS), SCRATCH_REL);
check('git status is byte-identical to the start', statusAfter === statusBefore, `${statusBefore.length} → ${statusAfter.length} bytes`);
check(
  'ratchet baseline untouched',
  JSON.stringify(baselineBefore) === JSON.stringify(baselineAfter),
  `${JSON.stringify(baselineBefore)} → ${JSON.stringify(baselineAfter)}`,
);

const warnings = [];
if (!hookLineDiscriminating) {
  warnings.push(
    `.husky/pre-push runs "npx ${RATCHET_ARGS_HOOK.join(' ')}", which exits ${steps.ratchetHookControl.exitCode} on a CLEAN tree ` +
      `(vitest 4 parses bare --silent as taking a value). That line is red no matter what, so it cannot discriminate a ` +
      `raw-toast regression; the ratchet assertions above use "--silent=true". Fix the hook line.`,
  );
}

const pass = checks.every((c) => c.pass);

const doc = {
  proof: 'EV-GUARD',
  pass,
  commit,
  startedAt,
  finishedAt: new Date().toISOString(),
  rule: RULE,
  scratchFile: SCRATCH_REL,
  ratchetBaseline: { before: baselineBefore, after: baselineAfter },
  commands: Object.fromEntries(
    Object.entries(steps).map(([k, v]) => [
      k,
      { command: v.command, cwd: v.cwd, exitCode: v.exitCode, ms: v.ms, output: v.output.slice(-4000) },
    ]),
  ),
  preCommit: { command: steps.lintRaw?.command ?? null, exitCode: steps.lintRaw?.exitCode ?? null, rejected: steps.lintRaw?.exitCode !== 0 },
  prePush: {
    hookLine: `npx ${RATCHET_ARGS_HOOK.join(' ')}`,
    hookLineDiscriminating,
    command: steps.ratchetRaw?.command ?? null,
    exitCode: steps.ratchetRaw?.exitCode ?? null,
    rejected: steps.ratchetRaw?.exitCode !== 0,
  },
  git: { statusBeforeBytes: statusBefore.length, statusAfterBytes: statusAfter.length, treeRestored: statusAfter === statusBefore },
  checks,
  warnings,
};

const outDir = flagValue('--out-dir')
  ? path.resolve(flagValue('--out-dir'))
  : path.join(WALK_ROOT, new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'guard-proof.json');
fs.writeFileSync(outFile, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
fs.mkdirSync(WALK_ROOT, { recursive: true });
fs.writeFileSync(path.join(WALK_ROOT, 'latest-guard-proof.txt'), `${outDir}\n`, 'utf8');

console.log(`guard-proof · EV-GUARD · commit ${commit.slice(0, 8)} · rule ${RULE}`);
for (const c of checks) console.log(`  ${c.pass ? 'ok  ' : 'FAIL'}  ${c.name}${c.detail ? `  (${c.detail})` : ''}`);
for (const w of warnings) console.log(`\n  DEFECT (recorded, not fixed here): ${w}`);
console.log(`\nevidence: ${outFile}`);
console.log(pass ? 'PASS: the commit-time guard provably rejects a new raw toast, and the tree is unchanged.' : 'FAIL: the guard did not behave as claimed — see the rows above.');
process.exit(pass ? 0 : 1);
