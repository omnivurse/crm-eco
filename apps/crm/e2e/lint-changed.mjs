#!/usr/bin/env node
/**
 * lint-changed.mjs — "no NEW lint findings" gate for the walk CI.
 *
 * `npm run lint` (eslint . --max-warnings 0) is red on main because of
 * pre-existing debt in files the Road to Ten work does not own (~45 findings,
 * e.g. RecordDetailShellV2.tsx react-hooks/refs, ZohoContextualSidebar.tsx
 * no-restricted-syntax, stale eslint-disable directives). A naive
 * "lint every changed file" gate is red too, because Wave 0 touched three of
 * those files to add test-ids. This gate is the honest middle: for every
 * apps/crm source file changed against the base commit it lints BOTH the base
 * revision (`git show <base>:<path>` through eslint's stdin path, so the same
 * flat config applies) and the working copy, then fails only when a
 * (file, rule) pair has MORE findings than it had at the base. Warnings count
 * like errors (the repo bar is --max-warnings 0). Untracked files must be
 * clean. Pre-existing findings are reported as "carried" so the debt stays
 * visible until a cleanup item retires it.
 *
 *   node e2e/lint-changed.mjs                 # base = merge-base(HEAD, origin/main|main)
 *   LINT_BASE=HEAD node e2e/lint-changed.mjs  # only the working tree vs the last commit
 *   node e2e/lint-changed.mjs --strict        # any finding fails (plain eslint bar)
 *   node e2e/lint-changed.mjs --json          # machine-readable report on stdout
 *   node e2e/lint-changed.mjs --staged <paths…>  # lint-staged / pre-commit mode
 *
 * --staged is what the root package.json lint-staged entry runs: base = HEAD and
 * the file set comes from the arguments lint-staged appends, so committing a file
 * that already carried findings is fine while anything the commit ADDS (a raw
 * `toast.success('…')`, say) fails the hook. It also runs ESLint with cwd =
 * apps/crm, which the flat config needs: `files` globs resolve against the cwd,
 * so `eslint --config apps/crm/eslint.config.mjs` from the repo root silently
 * mis-scopes every path-specific override.
 *
 * Read-only: it never writes files and never fixes anything.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.resolve(APP_DIR, '..', '..');
const APP_REL = path.relative(REPO_ROOT, APP_DIR).split(path.sep).join('/');
const LINTABLE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const STRICT = process.argv.includes('--strict');
const JSON_OUT = process.argv.includes('--json');
const STAGED = process.argv.includes('--staged');
const FILE_ARGS = process.argv.slice(2).filter((a) => !a.startsWith('-'));

const git = (...args) =>
  execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

function resolveBase() {
  const explicit = process.env.LINT_BASE?.trim();
  if (explicit) return git('rev-parse', '--verify', `${explicit}^{commit}`);
  // Pre-commit: "did THIS commit add a finding?" — compare against the last commit.
  if (STAGED) return git('rev-parse', 'HEAD');
  for (const ref of ['origin/main', 'main']) {
    try {
      return git('merge-base', 'HEAD', ref);
    } catch {
      /* ref missing — try the next one */
    }
  }
  return git('rev-parse', 'HEAD');
}

/** lint-staged hands us absolute paths; keep the apps/crm ones, repo-relative. */
/**
 * Which roots this gate covers, and the cwd ESLint needs for each. apps/crm has
 * its own flat config whose `files` globs resolve against apps/crm; everything
 * else uses the repo-root config. Both are gated additively, so pre-existing
 * debt in a shared package cannot block an unrelated commit (the naive
 * `eslint --max-warnings 0` entry it replaces did exactly that).
 */
const ROOTS = [
  { rel: APP_REL, cwd: APP_DIR },
  { rel: 'packages', cwd: REPO_ROOT },
];
const rootFor = (rel) => ROOTS.find((r) => rel === r.rel || rel.startsWith(`${r.rel}/`)) ?? null;

function stagedFiles() {
  return [...new Set(FILE_ARGS.map((a) => path.relative(REPO_ROOT, path.resolve(REPO_ROOT, a)).split(path.sep).join('/')))]
    .filter((rel) => rootFor(rel) && LINTABLE.test(rel) && fs.existsSync(path.join(REPO_ROOT, rel)))
    .sort();
}

function changedFiles(base) {
  const paths = ROOTS.map((r) => r.rel);
  const tracked = git('diff', '--name-only', '--diff-filter=ACMR', base, '--', ...paths);
  const untracked = git('ls-files', '--others', '--exclude-standard', '--', ...paths);
  const all = new Set([...tracked.split('\n'), ...untracked.split('\n')].map((l) => l.trim()).filter(Boolean));
  return [...all]
    .filter((rel) => rootFor(rel) && LINTABLE.test(rel) && fs.existsSync(path.join(REPO_ROOT, rel)))
    .sort();
}

function baseSource(base, rel) {
  try {
    return execFileSync('git', ['show', `${base}:${rel}`], { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null; // did not exist at the base → every finding is new
  }
}

const ruleKey = (m) => m.ruleId ?? (/eslint-disable/i.test(m.message) ? 'unused-eslint-disable' : 'parse-or-unknown');

function tally(messages) {
  const counts = new Map();
  for (const m of messages) counts.set(ruleKey(m), (counts.get(ruleKey(m)) ?? 0) + 1);
  return counts;
}

const base = resolveBase();
const files = STAGED ? stagedFiles() : changedFiles(base);
const eslintByCwd = new Map();
const eslintFor = (rel) => {
  const { cwd } = rootFor(rel);
  if (!eslintByCwd.has(cwd)) eslintByCwd.set(cwd, new ESLint({ cwd, warnIgnored: false }));
  return eslintByCwd.get(cwd);
};

const report = { base, baseShort: base.slice(0, 8), strict: STRICT, files: [], carried: 0, fresh: 0, checked: 0 };

for (const rel of files) {
  const abs = path.join(REPO_ROOT, rel);
  const eslint = eslintFor(rel);
  if (await eslint.isPathIgnored(abs)) continue;
  report.checked += 1;
  const [headResult] = await eslint.lintFiles([abs]);
  const headMessages = headResult?.messages ?? [];
  const src = baseSource(base, rel);
  let baseMessages = [];
  if (src !== null) {
    const [baseResult] = await eslint.lintText(src, { filePath: abs, warnIgnored: false });
    baseMessages = baseResult?.messages ?? [];
  }
  const headCounts = tally(headMessages);
  const baseCounts = tally(baseMessages);
  const fresh = [];
  let carriedHere = 0;
  // Per (file, rule): anything above the base count is new; the rest is carried debt.
  for (const [rule, n] of headCounts) {
    const allowed = STRICT ? 0 : baseCounts.get(rule) ?? 0;
    const over = Math.max(0, n - allowed);
    carriedHere += n - over;
    if (over > 0) {
      const where = headMessages.filter((m) => ruleKey(m) === rule).slice(-over);
      fresh.push(...where.map((m) => ({ rule, line: m.line, column: m.column, severity: m.severity, message: m.message })));
    }
  }
  report.carried += carriedHere;
  report.fresh += fresh.length;
  report.files.push({ file: rel, existedAtBase: src !== null, base: baseMessages.length, head: headMessages.length, carried: carriedHere, fresh });
}

if (JSON_OUT) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  const baseLabel = process.env.LINT_BASE ? ' (LINT_BASE)' : STAGED ? ' (HEAD, staged)' : ' (merge-base with main)';
  console.log(`lint-changed · base ${report.baseShort}${baseLabel} · ${report.checked} changed file(s) under ${ROOTS.map((r) => r.rel).join(' + ')}${STRICT ? ' · --strict' : ''}`);
  for (const f of report.files) {
    const flag = f.fresh.length > 0 ? 'NEW ' : f.carried > 0 ? 'debt' : 'ok  ';
    console.log(`  ${flag}  ${f.file}  base=${f.existedAtBase ? f.base : 'n/a'} head=${f.head} carried=${f.carried} new=${f.fresh.length}`);
    for (const m of f.fresh) console.log(`        ${m.line}:${m.column}  ${m.rule}  ${m.message}`);
  }
  console.log(`\ncarried (pre-existing, not introduced here): ${report.carried}   new: ${report.fresh}`);
  console.log(
    report.fresh === 0
      ? 'OK: no new lint findings in changed files.'
      : STAGED
        ? 'FAIL: this commit adds lint findings — fix them (raw toast copy → toastCopy.* from @/lib/crm/toast-copy).'
        : 'FAIL: new lint findings — fix them before the walk counts anything.',
  );
}
process.exit(report.fresh === 0 ? 0 : 1);
