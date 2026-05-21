# CRM-Eco Upgrade Bundle

Everything needed to bring `/Users/qloudagent/Documents/GitHub/crm-eco` up to the saudemax production standard for enrollment, billing, and commissions.

**Generated:** 2026-05-21
**Production constraint:** CRM-Eco DB is live. All work is additive — no data loss.

## Files in this folder

| File | What it is |
|---|---|
| `00_README.md` | This index |
| `01_UPGRADE_PLAN.md` | **Backend deliverable.** Enrollment / billing / commissions upgrade — gap analysis + 12 Cursor prompts + operator checklist. Kickoff questions answered. |
| `02_SAUDEMAX_REFERENCE_MAP.md` | Saudemax architecture map (enrollment / billing / commissions reference) |
| `03_CRM_ECO_CURRENT_STATE.md` | Inventory of what crm-eco already has for those domains |
| `04_MEMBER_PORTAL_PROMPTS.md` | **Member portal deliverable.** Bring `apps/portal` to MPB PWA feature parity — 11 Cursor prompts (M1–M11). Backed by an exhaustive MPB feature map; portal current-state was not directly inspected, but every prompt enforces an INTEGRATE-don't-overwrite rule, so existing work is preserved. |

## How to use

**Two independent tracks. Run in any order, or pick one if scoping is tight:**

**Track A — Backend (enrollment / billing / commissions):**
1. Open `01_UPGRADE_PLAN.md`.
2. Read the "Critical guardrails" + "Schema reality" sections.
3. Run prompts 1 → 12 in order. Review diff, typecheck, commit between each.

**Track B — Member portal:**
1. Open `04_MEMBER_PORTAL_PROMPTS.md`.
2. Read the "Critical guardrails" + "Architectural decisions" sections.
3. Run prompts M1 → M11 in order. Review diff, typecheck, browser-test, commit between each.

Tracks are independent — Track B doesn't strictly require Track A to be done first, but Prompt M8 (signed contract download) relies on the `agreement_signatures` table created in Track A Prompt 1, and Track A Prompt 4 (contract PDF generation). If you run B first, those pieces will appear as no-ops in M8 until A is in.

## Key decisions baked in

- **Cost column:** `enrollments.base_monthly_cost` (NOT `monthly_cost`)
- **End column:** `enrollments.end_date` (NOT `inactive_date`)
- **Active status:** `'approved'` (NOT `'active'`)
- **Scheduler:** Vercel Cron in `apps/admin/vercel.json` → Next.js Route Handlers → Supabase Edge Functions
- **PDF renderer:** Next.js Route Handler with `puppeteer-core` + `@sparticuz/chromium-min` on Vercel
- **Payment processor:** Authorize.Net (primary, already wired); Stripe adapter present but inactive
- **Smoke test:** runs against a fresh `smoke_test` org, never PIFH

## Operator pre-flight

- [ ] `gh auth status`, `vercel whoami`, `supabase projects list` → confirm crm-eco / Double Helix accounts (NOT omnivurse or saudemax)
- [ ] `supabase db dump --linked --file backups/pre-upgrade-$(date +%F).sql`
- [ ] Confirm PIFH org_id in `.env.local`
- [ ] Latest migration in repo: `202605200001` — new ones start at `202605210001`

## Reference paths

- CRM-Eco repo: `/Users/qloudagent/Documents/GitHub/crm-eco`
- Saudemax reference repo (separate DB — do not connect): `/Users/qloudagent/Desktop/Desktop/APPLICATIONS/saudemax-admin-system`
