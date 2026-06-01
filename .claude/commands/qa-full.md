---
description: Run the full QA suite — discovery + all enabled specialists + judge + reporter. Outputs reports/<timestamp>/summary.md.
---

# /qa-full

Run the entire QA Agent Kit suite against the current repo.

## Steps

### 1. Pre-flight
- Confirm `.claude/qa/config.json` and `.claude/qa/manifest.json` exist. If manifest is older than 24 hours OR the user has changed code since manifest was generated (check `git status` and compare manifest's `generated_at` to file mtimes), warn and offer to re-run discovery first.
- Check for `.claude/qa/PAUSE`. If present, refuse to run and tell the user to remove it.

### 2. Account check
If this is the first run of the session (no prior recent `gh auth status` in transcript), run account verification:
```
gh auth status & vercel whoami & supabase projects list
```
Confirm with the user that accounts match this project before any DB-touching specialist runs.

### 3. Spawn qa-orchestrator
Use the Agent tool with `subagent_type: qa-orchestrator`. Pass:
- Scope: `"full"`
- Repo root: current working directory

The orchestrator handles everything from here: discovery refresh (if needed), specialist fan-out, judging, reporting.

### 4. Surface the result
When the orchestrator completes, it returns:
- The verdict line
- P0 findings (inline)
- Path to `summary.md`

Display these to the user verbatim. Add one line: "Full report: `<path>`. Re-run after fixes with `/qa-full` or scope to one specialist with `/qa-feature <name>` (when available)."

## Hard rules

- Never bypass the orchestrator's safety gates by spawning specialists directly.
- Never edit findings.json or summary.md after the run.
- If the orchestrator reports an aborted run (safety gate failure), surface the exact reason — do not retry or suggest workarounds.
