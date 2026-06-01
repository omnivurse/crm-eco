---
description: First-time QA Agent Kit setup in this repo. Detects framework, scaffolds config.json, runs initial discovery, prints next steps.
---

# /qa-bootstrap

You are running the QA Agent Kit **bootstrap** flow. This is the user's first invocation in this repo. Your job: set up the kit safely, generate a starter config, and produce a first manifest.

## Steps

### 1. Verify install
Check that these exist:
- `.claude/qa/config.json`
- `.claude/agents/qa-orchestrator.md`
- `.claude/agents/qa-discovery.md`
- `.claude/agents/qa-reporter.md`

If any are missing, instruct the user to run `~/Desktop/QA-Agent-Kit/install.sh` from the repo root, and stop.

### 2. Verify accounts (Working Relationship Rule)
Before any DB-touching work, confirm which Supabase/GitHub/Vercel accounts should be connected. Run in parallel:
```
gh auth status
vercel whoami 2>/dev/null || echo "(no vercel CLI / not logged in)"
supabase projects list 2>/dev/null || echo "(no supabase CLI / not logged in)"
```
Print results and ask the user: "Do these accounts match the project we're setting up QA for?" Wait for confirmation before proceeding.

### 3. Inspect config
Read `.claude/qa/config.json`. If it still has `"REPLACE_ME"` placeholders, walk the user through filling them in:
- `project`: repo/product name
- `framework`: detect from `package.json` and propose, but confirm
- `monorepo` + `apps[]`: detect from filesystem and propose
- `supabase.test_project_ref`: ask user (must be a DEDICATED test project, never prod)
- `supabase.test_tenants`: at least two for RLS testing; org_ids must already exist in the test project
- `integrations`: ask which providers are in use and confirm sandbox/test mode for each
- `_safety.production_urls_blocklist`: ask for the prod URL(s) so the suite refuses to ever touch them

Do not write secrets into config.json — passwords stay in env vars referenced by `password_env`.

### 4. Run qa-discovery
Spawn the **qa-discovery** subagent with the now-valid config. It writes `.claude/qa/manifest.json`. This is Tier 0 — read-only.

### 5. Sanity-check the manifest
Read manifest.json and surface to the user:
- How many routes, tables, forms, integrations discovered
- Whether DB source was `live` or `migrations` (warn if migrations only)
- Any `"unknown"` auth_required routes (these will need a hand classification or smarter heuristic)
- Any warnings

Ask: "Does this match your mental model of the project? Anything missing/wrong?"

### 6. Print next steps
```
✓ QA Agent Kit ready.
  Config:    .claude/qa/config.json
  Manifest:  .claude/qa/manifest.json
  Next:      /qa-full     (run the entire suite)
             /qa-feature <name>   (test one feature)   [coming soon]
             /qa-since main       (test only what changed) [coming soon]
```

## Hard rules

- Never auto-fill `test_project_ref` or `production_urls_blocklist` from guesses — these are safety-critical.
- Never proceed past step 2 without account confirmation.
- Never run any specialist during bootstrap — discovery only.
