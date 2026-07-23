# 04 — Agents Module

> Part of the CRM-ECO vNext Master Build Prompt Package. See `README.md`.

---

## Original Prompt (verbatim)

Instead of "View Agents", build: Recruiting, Hierarchy, Downline, Licenses, Appointments, Contracts, Training, Performance, Goals, Leaderboards, Compensation, Bonuses, Chargebacks, Marketing, Documents, Notes, Tasks, AI Coaching, Pipeline, Renewals, Compliance, Portal.

---

## Current State

Agents ("Advisors" / "Producers") is a **full** module.

- List: `apps/admin/src/app/(dashboard)/agents/page.tsx` (pagination only — no search/filters/bulk).
- Detail: `agents/[id]/page.tsx` with tabs: producer, profile, downline, licensing, enrollment, commissions.
- Also: `agents/tree` (hierarchy), `agents/assignment` (assignment rules), `agents/bill-groups`, `agents/import` (license import), `agents/new`, `agents/[id]/edit`.
- Data: `advisors` table (+ `agent_level_id`, `commission_eligible`, `commission_hold`, `enrollment_code`, lifetime/pending commission rollups), `agent_levels`, hierarchy via `get_advisor_upline` / `get_advisor_downline_count` RPCs.

## Gap Analysis

| vNext area | Status |
|---|---|
| Hierarchy / Downline | Present (`agents/tree`, RPCs) |
| Licenses / Contracts | Present (licensing tab, license import) |
| Compensation / Commissions | Present (commissions tab, ties to `06`) |
| Performance / Pipeline | Partial (enrollment tab) |
| Recruiting / Onboarding pipeline | Missing |
| Appointments (carrier appointments) | Missing |
| Training | Missing |
| Goals / Leaderboards | Missing |
| Bonuses / Chargebacks | Partial (commission adjustments exist; no dedicated UI) |
| Marketing (agent enrollment links) | Partial (`enrollment-links/agents` exists) |
| Notes / Tasks / Documents | Missing on agent detail |
| AI Coaching | Missing |
| Compliance | Partial (licensing) |
| Renewals | Missing |
| Portal | Separate app (`advisor-portal`) |

## Build Notes

- Fix the biggest UX gap first: the agent **list has no search/filter/bulk** — this is exactly what the shared list-view module (`02`) fixes.
- Reuse the members Command Center tab pattern for agent detail; add Notes/Docs/Tasks via the shared mixins.
- Leaderboards/Goals/Performance can read from the existing `advisor_commission_summary` rollups — no new aggregation needed initially.
- AI Coaching → per-module copilot (`14`) fed by commission + enrollment history.
- Keep agent-facing self-service in `advisor-portal`/`portal`; this module is the back-office view. Do not fork agent identity — one `advisors` row is the source of truth.
