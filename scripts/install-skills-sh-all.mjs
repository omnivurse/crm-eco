#!/usr/bin/env node
/**
 * Discover skills.sh repositories and bulk-install all skills into Cursor (global).
 *
 * Usage:
 *   node scripts/install-skills-sh-all.mjs [--dry-run] [--max-repos N] [--resume]
 */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const API_BASE = process.env.SKILLS_API_URL || 'https://skills.sh';
const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, '.cache');
const REPOS_FILE = join(CACHE_DIR, 'skills-sh-repos.json');
const PROGRESS_FILE = join(CACHE_DIR, 'skills-sh-install-progress.json');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const resume = args.includes('--resume');
const maxReposArg = args.find((a) => a.startsWith('--max-repos='));
const maxRepos = maxReposArg ? Number(maxReposArg.split('=')[1]) : Infinity;

const SEED_REPOS = [
  'vercel-labs/skills',
  'vercel-labs/agent-skills',
  'vercel-labs/agent-browser',
  'anthropics/skills',
  'mattpocock/skills',
  'microsoft/azure-skills',
  'remotion-dev/skills',
  'larksuite/cli',
  'juliusbrussee/caveman',
  'obra/superpowers',
  'supabase/agent-skills',
  'nextlevelbuilder/ui-ux-pro-max-skill',
  'scrapegraphai/just-scrape',
  'leonxlnx/taste-skill',
  'roin-orca/skills',
  'shadcn/ui',
  'pbakaus/impeccable',
  'coreyhaines31/marketingskills',
  'lllllllama/ai-paper-reproduction-skill',
  'lllllllama/rigorpilot-skills',
  'emilkowalski/skills',
  'arvindrk/extract-design-system',
  'firebase/agent-skills',
  'sentry/dev',
  'heygen-com/hyperframes',
  'firecrawl/cli',
  'better-auth/skills',
  'get-convex/agent-skills',
  'microsoft/playwright-cli',
  'browser-act/skills',
  'browser-use/browser-use',
  'higgsfield-ai/skills',
  'stripe/stripe',
  'resend/resend',
  'vercel/turborepo',
  'vercel/ai',
  'vercel/next.js',
];

const SEARCH_TERMS = [
  'react', 'next', 'node', 'typescript', 'javascript', 'python', 'rust', 'go', 'java',
  'design', 'frontend', 'backend', 'mobile', 'android', 'ios', 'swift', 'kotlin',
  'agent', 'skill', 'workflow', 'test', 'testing', 'tdd', 'debug', 'review', 'deploy',
  'vercel', 'azure', 'aws', 'gcp', 'google', 'cloud', 'docker', 'kubernetes', 'k8s',
  'data', 'database', 'postgres', 'mysql', 'mongo', 'redis', 'graphql', 'rest', 'api',
  'web', 'html', 'css', 'tailwind', 'ui', 'ux', 'seo', 'marketing', 'copy', 'email',
  'stripe', 'supabase', 'firebase', 'convex', 'prisma', 'drizzle', 'auth', 'security',
  'pdf', 'docx', 'pptx', 'xlsx', 'image', 'video', 'audio', 'browser', 'playwright',
  'crm', 'saas', 'billing', 'invoice', 'analytics', 'report', 'chart', 'table',
  'mcp', 'openai', 'claude', 'gemini', 'copilot', 'cursor', 'codex', 'llm', 'rag',
  'git', 'github', 'gitlab', 'ci', 'cd', 'devops', 'infra', 'terraform', 'pulumi',
  'remotion', 'canvas', 'figma', 'shadcn', 'radix', 'chakra', 'material',
  'brainstorm', 'plan', 'handoff', 'triage', 'prototype', 'refactor', 'architecture',
  'commit', 'merge', 'conflict', 'lint', 'format', 'audit', 'performance', 'optimize',
  'health', 'medical', 'insurance', 'enrollment', 'member', 'portal', 'advisor',
];

async function searchSkills(query, limit = 500) {
  const url = `${API_BASE}/api/search?q=${encodeURIComponent(query)}&limit=${limit}`;
  const res = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.skills ?? [];
}

async function discoverRepos() {
  mkdirSync(CACHE_DIR, { recursive: true });
  if (existsSync(REPOS_FILE) && resume) {
    return JSON.parse(readFileSync(REPOS_FILE, 'utf8'));
  }

  const repos = new Set(SEED_REPOS);
  for (const term of SEARCH_TERMS) {
    try {
      const skills = await searchSkills(term, 500);
      for (const skill of skills) {
        if (skill.source?.includes('/')) repos.add(skill.source);
      }
      process.stdout.write(`discovered ${repos.size} repos (term: ${term})\r`);
      await delay(100);
    } catch (err) {
      console.warn(`\nSearch failed for "${term}": ${err.message}`);
    }
  }

  const sorted = [...repos].sort();
  writeFileSync(REPOS_FILE, JSON.stringify(sorted, null, 2));
  console.log(`\nCached ${sorted.length} repositories to ${REPOS_FILE}`);
  return sorted;
}

function loadProgress() {
  if (!resume || !existsSync(PROGRESS_FILE)) {
    return { completed: [], failed: [] };
  }
  return JSON.parse(readFileSync(PROGRESS_FILE, 'utf8'));
}

function saveProgress(progress) {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function runSkillsAdd(repo) {
  return new Promise((resolve) => {
    const child = spawn(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['skills', 'add', repo, '--all', '-g', '-a', 'cursor', '-y'],
      { stdio: 'inherit', shell: true },
    );
    child.on('close', (code) => resolve(code ?? 1));
    child.on('error', () => resolve(1));
  });
}

async function main() {
  const repos = await discoverRepos();
  const progress = loadProgress();
  const done = new Set(progress.completed);
  const pending = repos.filter((repo) => !done.has(repo));
  const limited = Number.isFinite(maxRepos) ? pending.slice(0, maxRepos) : pending;

  console.log(`Installing skills from ${limited.length} repositories into Cursor (global).`);
  if (dryRun) {
    limited.forEach((repo) => console.log(`  ${repo}`));
    return;
  }

  let ok = 0;
  let fail = 0;
  for (const [i, repo] of limited.entries()) {
    console.log(`\n[${i + 1}/${limited.length}] ${repo}`);
    const code = await runSkillsAdd(repo);
    if (code === 0) {
      ok += 1;
      progress.completed.push(repo);
    } else {
      fail += 1;
      progress.failed.push(repo);
    }
    saveProgress(progress);
    await delay(200);
  }

  console.log(`\nDone. Success: ${ok}, Failed: ${fail}, Total installed repos: ${progress.completed.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
