/**
 * walk-gate.ts — the pass/fail verdict over a recorded walk (EV-7).
 *
 * `playwright test` already fails on a HARD task or a trap thrown in
 * global-setup, but two evidence failures survive a green exit code:
 *   - a SOFT task (`walk.task(..., { soft: true })`) records pass=false and
 *     lets the spec continue, so a budget breach never reaches the runner;
 *   - a run that recorded nothing at all (spec file filtered out, crash before
 *     the first task) exits 0 with an empty tasks array.
 * CI must be red for both, so the gate reads walk.json — the artifact the
 * regrade is scored from — and grades it independently of the runner.
 *
 * It also refuses a run that did not measure what ships: the evidence must come
 * from the LOCAL Supabase stack (env.supabaseUrl) and from a PRODUCTION build
 * (env.serverMode === 'prod'). The WALK_DEV=1 shortcut is for iterating, and a
 * walk.json it produced is rejected here rather than quietly scored.
 *
 * "A production build" is not the same as "a build of this commit", so a graded
 * document must also carry env.buildId — the identity of the build that actually
 * answered — leading with the commit it claims. Without it the run could have
 * adopted a leftover `next start` and scored an older bundle under today's SHA.
 *
 * CLI (from apps/crm):
 *   npm run walk:crm:gate                       # grades the run in artifacts/crm-walk/latest.txt
 *   npm run walk:crm:gate -- --dir <run dir>
 *   npm run walk:crm:gate -- --allow-soft LS-mobile-filter,T2-above-fold
 *   npm run walk:crm:gate -- --summary "$GITHUB_STEP_SUMMARY"
 *   npm run walk:crm:gate -- --require-guard-proof   # also demand guard-proof.json
 *
 * `--require-guard-proof` (EV-GUARD) is opt-in on purpose: the commit-time toast
 * guard has no Playwright row, so its evidence is a separate artifact written by
 * `npm run walk:crm:guard-proof -- --out-dir <run dir>`. CI asks for it; a local
 * `npm run walk:crm:gate` over an older run folder must not go red for missing a
 * file that folder never had.
 *
 * Exit codes: 0 every trap and task passed · 1 at least one failure · 2 no
 * walk.json to grade (the run never produced evidence).
 */
import fs from 'node:fs';
import path from 'node:path';
import { WALK_ROOT, isLocalSupabaseHost } from './env';
import type { WalkJson } from './walk-report';

export interface WalkTaskRow {
  id: string;
  label: string;
  clicks: number;
  keypresses: number;
  ms: number;
  budget: number;
  pass: boolean;
  soft?: boolean;
  reason?: string;
  project?: string;
}

export interface GateOptions {
  /** Task ids allowed to be red without failing the gate (soft rows only). Each one is a known, tracked debt. */
  allowSoft?: string[];
  /** Minimum task rows a real run must produce. */
  minTasks?: number;
}

export interface GateResult {
  ok: boolean;
  failures: string[];
  allowed: string[];
  counts: { traps: number; trapFails: number; tasks: number; taskFails: number };
}

function taskLabel(t: WalkTaskRow): string {
  return `${t.id} [${t.project ?? '-'}]`;
}

/** Grade a walk.json document. Pure — no fs, no process. */
export function gradeWalk(doc: WalkJson, options: GateOptions = {}): GateResult {
  const allowSoft = new Set(options.allowSoft ?? []);
  const minTasks = options.minTasks ?? 1;
  const tasks = doc.tasks as unknown as WalkTaskRow[];
  const failures: string[] = [];
  const allowed: string[] = [];

  // The evidence must come from the local stack — a walk recorded against any
  // other Supabase host is not admissible, however green it looks.
  if (!isLocalSupabaseHost(doc.env.supabaseUrl)) {
    failures.push(`env.supabaseUrl is not local: ${doc.env.supabaseUrl}`);
  }
  // …and from the binary that ships. `next dev` carries framework artefacts
  // production does not have (Next 16 wraps the app in the dev overlay's own
  // error boundary on the server only, shifting every useId below <body>), so a
  // dev-mode walk grades hydration against a build no user will ever load. The
  // harness allows WALK_DEV=1 for a fast edit loop; it is never a result.
  if (doc.env.serverMode !== 'prod') {
    failures.push(
      doc.env.serverMode === 'dev'
        ? 'env.serverMode is "dev" — this run measured `next dev`, not the production build. It is an UNGRADED iteration run (WALK_DEV=1); re-record without WALK_DEV.'
        : `env.serverMode is ${JSON.stringify(doc.env.serverMode ?? null)} — the run did not record which binary it graded, so it is not admissible evidence. Re-record with the current harness.`,
    );
  }
  // …and from a build of THIS source. serverMode only proves the binary; a
  // `next start` left over from an earlier state of the tree is production too,
  // and reuseExistingServer will adopt it while the document goes on claiming
  // today's commit. env.buildId is the identity the server actually served
  // (TRAP:server-mode proved it against the document); its first field is the
  // commit that build came from, so a document whose buildId does not lead with
  // its own `commit` is describing a bundle it did not grade.
  if (doc.env.serverMode === 'prod') {
    const buildId = doc.env.buildId;
    if (typeof buildId !== 'string' || buildId.length === 0) {
      failures.push(
        'env.buildId is missing — the run recorded no identity for the build it graded, so it cannot show the evidence came from this commit rather than a stale server. Re-record with the current harness.',
      );
    } else if (!buildId.startsWith(doc.commit.slice(0, 12))) {
      failures.push(
        `env.buildId is ${buildId} but the run claims commit ${doc.commit.slice(0, 12)} — the document names a commit it did not grade.`,
      );
    }
  }
  if (tasks.length < minTasks) {
    failures.push(`only ${tasks.length} task row(s) recorded (expected at least ${minTasks}) — the run produced no evidence`);
  }

  for (const trap of doc.traps) {
    if (!trap.pass) failures.push(`TRAP:${trap.name}${trap.project ? ` [${trap.project}]` : ''} — ${trap.detail}`);
  }

  const seen = new Set<string>();
  for (const t of tasks) {
    const key = `${t.id}|${t.project ?? '-'}`;
    if (seen.has(key)) {
      // retries would append a second row for the same task and double-count it;
      // the runner keeps retries at 0 for exactly this reason.
      failures.push(`${taskLabel(t)} recorded twice — counts cannot be trusted (was the run retried?)`);
    }
    seen.add(key);

    if (!t.pass) {
      const line = `${taskLabel(t)} clicks=${t.clicks}/${t.budget} keys=${t.keypresses}${t.reason ? ` — ${t.reason}` : ''}`;
      if (t.soft && allowSoft.has(t.id)) allowed.push(line);
      else failures.push(line);
      continue;
    }
    if (t.clicks > t.budget) {
      failures.push(`${taskLabel(t)} is marked pass but clicks=${t.clicks} exceeds budget ${t.budget}`);
    }
  }

  return {
    ok: failures.length === 0,
    failures,
    allowed,
    counts: {
      traps: doc.traps.length,
      trapFails: doc.traps.filter((t) => !t.pass).length,
      tasks: tasks.length,
      taskFails: tasks.filter((t) => !t.pass).length,
    },
  };
}

/**
 * EV-GUARD evidence — the JSON `e2e/guard-proof.mjs` writes. Only the fields the
 * gate grades are typed; the script records the full command output as well.
 */
export interface GuardProofJson {
  proof?: string;
  pass?: boolean;
  commit?: string;
  rule?: string;
  preCommit?: { exitCode?: number | null; rejected?: boolean };
  prePush?: { exitCode?: number | null; rejected?: boolean };
  git?: { treeRestored?: boolean };
  checks?: { name: string; pass: boolean }[];
}

/**
 * Grade a guard-proof.json. Pure — no fs, no process. `null` means the run folder
 * had none, which is itself a failure when the caller asked for the proof.
 *
 * It re-derives the verdict from the recorded facts rather than trusting the
 * script's own `pass` flag: a proof whose pre-commit run exited 0, or that left
 * the tree dirty, is not evidence however it labelled itself.
 */
export function gradeGuardProof(doc: GuardProofJson | null, expectedCommit?: string): string[] {
  const failures: string[] = [];
  if (!doc) return ['guard-proof.json missing — the commit-time guard was never proven for this run'];
  if (doc.pass !== true) {
    const red = (doc.checks ?? []).filter((c) => !c.pass).map((c) => c.name);
    failures.push(`GUARD-PROOF failed${red.length > 0 ? `: ${red.join('; ')}` : ''}`);
  }
  if (doc.preCommit?.exitCode === 0) failures.push('GUARD-PROOF pre-commit run exited 0 — the guard did not reject the raw toast');
  if (doc.prePush?.exitCode === 0) failures.push('GUARD-PROOF pre-push ratchet exited 0 — the extra raw site was not rejected');
  if (doc.git?.treeRestored !== true) failures.push('GUARD-PROOF left the working tree changed — the proof is not repeatable');
  if (expectedCommit && doc.commit && doc.commit !== expectedCommit) {
    failures.push(`GUARD-PROOF is from commit ${doc.commit.slice(0, 8)}, the walk from ${expectedCommit.slice(0, 8)} — stale evidence`);
  }
  return failures;
}

/** GitHub-flavoured markdown for $GITHUB_STEP_SUMMARY (also readable in a terminal). */
export function summarizeWalk(doc: WalkJson, result: GateResult): string {
  const tasks = doc.tasks as unknown as WalkTaskRow[];
  const lines: string[] = [];
  lines.push(`### CRM walk — ${result.ok ? 'PASS' : 'FAIL'}`);
  lines.push('');
  lines.push(`commit \`${doc.commit.slice(0, 8)}\` · role ${doc.env.role} · nav ${doc.env.navProfile} · layoutV2 ${doc.env.layoutV2}`);
  lines.push(`${doc.env.baseURL} → ${doc.env.supabaseUrl}`);
  lines.push(
    doc.env.serverMode === 'prod'
      ? `server: **production build** (\`next build\` + \`next start\`, build \`${doc.env.buildId ?? 'unstamped'}\`)`
      : `server: **${doc.env.serverMode ?? 'unrecorded'}** — ⚠️ UNGRADED, this is not the build that ships`,
  );
  lines.push('');
  lines.push(`| | pass | fail |`);
  lines.push(`| --- | ---: | ---: |`);
  lines.push(`| traps | ${result.counts.traps - result.counts.trapFails} | ${result.counts.trapFails} |`);
  lines.push(`| tasks | ${result.counts.tasks - result.counts.taskFails} | ${result.counts.taskFails} |`);
  if (result.failures.length > 0) {
    lines.push('', '#### Failures', '');
    for (const f of result.failures) lines.push(`- ${f}`);
  }
  if (result.allowed.length > 0) {
    lines.push('', '#### Tolerated soft failures (--allow-soft)', '');
    for (const f of result.allowed) lines.push(`- ${f}`);
  }
  const slowest = [...tasks].sort((a, b) => b.ms - a.ms).slice(0, 5);
  if (slowest.length > 0) {
    lines.push('', '#### Slowest tasks', '', '| task | project | clicks/budget | ms |', '| --- | --- | ---: | ---: |');
    for (const t of slowest) lines.push(`| ${t.id} | ${t.project ?? '-'} | ${t.clicks}/${t.budget} | ${t.ms} |`);
  }
  return `${lines.join('\n')}\n`;
}

/** The run folder to grade: --dir, else WALK_RUN_DIR, else artifacts/crm-walk/latest.txt. */
export function resolveRunDir(argv: string[] = process.argv.slice(2)): string | null {
  const flag = argv.indexOf('--dir');
  if (flag !== -1 && argv[flag + 1]) return path.resolve(argv[flag + 1]);
  if (process.env.WALK_RUN_DIR) return path.resolve(process.env.WALK_RUN_DIR);
  const latest = path.join(WALK_ROOT, 'latest.txt');
  if (!fs.existsSync(latest)) return null;
  const dir = fs.readFileSync(latest, 'utf8').trim();
  return dir.length > 0 ? dir : null;
}

function parseList(argv: string[], flag: string): string[] {
  const at = argv.indexOf(flag);
  if (at === -1 || !argv[at + 1]) return [];
  return argv[at + 1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function main(): void {
  const argv = process.argv.slice(2);
  const dir = resolveRunDir(argv);
  if (!dir) {
    console.error('walk-gate: no run folder — pass --dir <run dir> or record a walk first (npm run walk:crm).');
    process.exit(2);
  }
  const file = path.join(dir, 'walk.json');
  if (!fs.existsSync(file)) {
    console.error(`walk-gate: ${file} missing — the run produced no evidence.`);
    process.exit(2);
  }
  const doc = JSON.parse(fs.readFileSync(file, 'utf8')) as WalkJson;
  const allowSoft = [
    ...parseList(argv, '--allow-soft'),
    ...(process.env.WALK_ALLOW_SOFT ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  ];
  const result = gradeWalk(doc, { allowSoft });
  if (argv.includes('--require-guard-proof')) {
    const proofFile = path.join(dir, 'guard-proof.json');
    const proof = fs.existsSync(proofFile) ? (JSON.parse(fs.readFileSync(proofFile, 'utf8')) as GuardProofJson) : null;
    const guardFailures = gradeGuardProof(proof, doc.commit);
    if (guardFailures.length > 0) {
      result.failures.push(...guardFailures);
      result.ok = false;
    }
  }
  const summary = summarizeWalk(doc, result);
  console.log(summary);
  const summaryAt = argv.indexOf('--summary');
  const summaryFile = summaryAt !== -1 ? argv[summaryAt + 1] : undefined;
  if (summaryFile) fs.appendFileSync(summaryFile, summary);
  console.log(`walk-gate: ${result.ok ? 'PASS' : 'FAIL'} — ${file}`);
  process.exit(result.ok ? 0 : 1);
}

// Run only as a CLI (vitest imports this module for the unit test).
if (process.argv[1] && /walk-gate\.(ts|js|mjs)$/.test(process.argv[1])) main();
