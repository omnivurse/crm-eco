# Handoff → other machine: Jane Pulliam notes + AI config

**Date:** 2026-07-25  
**Reported by:** client reviewing Jane Pulliam's account in DHH  
**Prod project:** `sffisarikcreyyjzdjvb` (PIF-ECO-V2)  
**PIFH org (verify live):** `ac6e7228-2ea0-4582-8464-562c3e8ac56e`  
**Repo:** pull `main` first (`git pull origin main`)

---

## Executive summary (for the client)

Two separate issues — neither is a random UI bug:

| Symptom | Root cause | Fix on other machine |
|--------|------------|----------------------|
| Notes missing around “4-14-25”, can't see Secure HSA → Premium HSA | Jane Pulliam exists as **three Zoho contact duplicates** (same email). Notes attach per `zoho_record_id`; DHH only aggregates lead↔contact conversion links, **not** duplicate Zoho contacts. April **2025** gap is real (she was on ACA, not MPB). Secure→Premium plan notes in Zoho are dated **Mar 2026** with eff **04/01/26** — client may be reading 2026 as 2025. | Merge duplicates + re-link/recover orphaned notes (below) |
| “AI Assistance not configured” on ✨ Suggest | `OPENAI_API_KEY` not set on Vercel CRM deployment | Add env var + redeploy |

---

## Part A — Jane Pulliam: discovery (read-only)

Run on prod (`sffisarikcreyyjzdjvb`). **Read-only — no writes.**

### A1. Find all CRM contact rows for Jane

```sql
SELECT
  r.id,
  r.title,
  r.email,
  r.status,
  r.data->>'zoho_record_id' AS zoho_id,
  r.created_at,
  (SELECT count(*)
   FROM crm_notes n
   WHERE n.record_id = r.id
     AND n.deleted_at IS NULL) AS note_count
FROM crm_records r
JOIN crm_modules m ON m.id = r.module_id
WHERE m.key = 'contacts'
  AND r.org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e'::uuid  -- verify org id live
  AND r.deleted_at IS NULL
  AND (
    r.title ILIKE '%Jane Pulliam%'
    OR r.email ILIKE 'janebaby311@gmail.com'
  )
ORDER BY r.created_at;
```

**Expected:** up to **3** rows if import did not dedupe by email, or **1** row with notes “missing” from the other Zoho parents.

### A2. Zoho parent IDs (from import bundle)

| Zoho contact ID | Role in Zoho | Key notes in export |
|-----------------|--------------|---------------------|
| `zcrm_1579374000069994407` | Primary (2021) | History, Dec 2024 MPB cancel, **only Apr 2025 note:** “4/14/25 requested the 1095 c” |
| `zcrm_1579374000153586130` | C4/ACA track (Dec 2024) | 12/3/24 C4 enrollment, 11/20/25 income, Mar 2026 C4 disenrollment snapshots |
| `zcrm_1579374000041659570` | Old cancelled (2019) | **Mar 17, 2026** Wendy note: Premium HSA re-enrollment ($1500/$336) |

Source: `docs/_clean/supabase/notes.jsonl`, `contacts.jsonl`

### A3. Notes on each Zoho parent (staging or live)

```sql
-- If import_notes_staging still populated:
SELECT parent_id, count(*) AS staged_notes
FROM import_notes_staging
WHERE parent_id IN (
  'zcrm_1579374000069994407',
  'zcrm_1579374000153586130',
  'zcrm_1579374000041659570',
  '1579374000069994407',
  '1579374000153586130',
  '1579374000041659570'
)
GROUP BY parent_id;

-- Live notes whose body mentions plan change (any Jane record id from A1):
SELECT n.id, n.record_id, n.created_at, left(n.body, 120) AS preview
FROM crm_notes n
WHERE n.deleted_at IS NULL
  AND n.record_id IN (
    SELECT r.id FROM crm_records r
    WHERE r.email ILIKE 'janebaby311@gmail.com'
      AND r.deleted_at IS NULL
  )
  AND (
    n.body ILIKE '%Premium HSA%'
    OR n.body ILIKE '%Secure%HSA%'
    OR n.body ILIKE '%1095%'
    OR n.body ILIKE '%4/14%'
  )
ORDER BY n.created_at DESC;
```

### A4. Orphan check (notes whose parent never matched a CRM record)

```sql
SELECT recover_zoho_notes_for_org(
  'ac6e7228-2ea0-4582-8464-562c3e8ac56e'::uuid,  -- verify org
  NULL
);
-- Re-run is idempotent; read inserted_count / orphan_parent_count only.
-- For a dry picture without inserting, count orphans manually:
SELECT count(*) AS orphan_staging_rows
FROM import_notes_staging s
LEFT JOIN crm_records r
  ON r.org_id = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e'::uuid
 AND (
       r.data->>'zoho_record_id' = s.parent_id
    OR r.data->>'zoho_record_id' = 'zcrm_' || s.parent_id
    OR replace(r.data->>'zoho_record_id', 'zcrm_', '') = s.parent_id
     )
WHERE r.id IS NULL
  AND s.note_content IS NOT NULL
  AND trim(s.note_content) <> ''
  AND s.parent_id IN (
    'zcrm_1579374000069994407',
    'zcrm_1579374000153586130',
    'zcrm_1579374000041659570'
  );
```

---

## Part B — Jane Pulliam: remediation (PROD WRITE — get approval first)

**Tier:** 1+  
**PROD WRITE RISK:** YES  
**Goal:** One canonical Jane Pulliam contact; all Zoho notes visible on that record.

### B1. Pick the keeper record

Use the row from **A1** that staff actually open in DHH (likely the primary `0069994407` or the most recently updated). Note its UUID as `:keeper_id`.

If **3 separate CRM rows** exist → merge losers into keeper (UI or API).  
If **1 row** but wrong/missing `zoho_record_id` → update `data.zoho_record_id` only after confirming with A1.

### B2. Merge duplicates in the CRM UI (preferred)

1. Open keeper record in DHH (`/crm/r/:keeper_id`).
2. **⋯ menu → Merge Duplicate…** (`MergeRecordDialog`).
3. Search for the other Jane Pulliam rows; merge **into** the keeper.
4. Repeat until one contact remains.

Verify merge moves/links notes per your merge RPC behavior (`apps/crm/src/components/crm/records/MergeRecordDialog.tsx`).

### B3. Re-run note recovery (if Mar 2026 notes still missing)

Fresh Zoho Notes CSV export → on machine with service role:

```bash
cd /path/to/crm-eco
# .env.local needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY for sffisarikcreyyjzdjvb

npx tsx scripts/recover-zoho-notes.ts /path/to/Notes_Export.csv \
  --org=ac6e7228-2ea0-4582-8464-562c3e8ac56e
```

Script: `scripts/recover-zoho-notes.ts` → stages CSV → calls `recover_zoho_notes_for_org` (idempotent, ±1 min dedup).

**Notes to expect after recovery on keeper** (if parent ids match):

- `Previous Membership: … Secure Care HSA Eff 07/01/21 to 12/31/24` (2026-03-18)
- `New Membership: … Premium HSA Eff 04/01/26` (2026-03-18)
- Wendy Premium HSA conversation (2026-03-17, may be on old zoho parent until merged)

### B4. Manual re-link (only if merge can't run)

If duplicate CRM rows can't be merged yet, **temporarily** copy orphan notes onto keeper (batch, idempotent):

```sql
BEGIN;

-- Example: move notes from loser record to keeper (replace UUIDs after A1)
-- UPDATE crm_notes
-- SET record_id = ':keeper_id'
-- WHERE record_id = ':loser_id'
--   AND deleted_at IS NULL;

-- Rehearse: SELECT count(*) FROM crm_notes WHERE record_id = ':loser_id';

ROLLBACK;  -- swap to COMMIT after approval + count check
```

**Abort if** affected row count ≠ expected from `SELECT count(*) … WHERE record_id = ':loser_id'`.

### B5. Client-facing clarification

When replying to the client:

- **April 2025:** She cancelled MPB effective 1/1/25 and was on Connect for Colorado; only concierge note on 4/14/25 (1095-C) exists in the export — not a Secure→Premium MPB change that month.
- **Plan change they remember:** Added in Zoho **March 2026**; effective **April 1, 2026** (Premium HSA). Worth confirming they meant **2026** not **2025**.

---

## Part C — AI “not configured” (Vercel, no DB writes)

**Symptom:** Clicking ✨ **Suggest** on a record field → toast “AI assistant not configured”.

**Cause:** `apps/crm/src/app/api/crm/ai/field-suggest/route.ts` returns `503` / `AI_NOT_CONFIGURED` when `OPENAI_API_KEY` is unset. Same for email draft (`/api/crm/ai/email-draft`).

### C1. Vercel env vars (CRM app)

| Variable | Required | Notes |
|----------|----------|--------|
| `OPENAI_API_KEY` | **Yes** | Server-side only; never `NEXT_PUBLIC_` |
| `OPENAI_MODEL_FIELD_SUGGEST` | No | Defaults to `gpt-4o-mini` |

```bash
# CLI alternative (from repo root, CRM project linked)
vercel env add OPENAI_API_KEY production
# paste key, then redeploy
vercel --prod
```

### C2. Verify after deploy

1. Open any contact → inline field → ✨ Suggest → should return text (not toast).
2. Optional: `curl -X POST https://<crm-host>/api/crm/ai/field-suggest` with auth cookie (or use browser Network tab).

---

## Part D — Verification checklist

After B + C:

- [ ] Exactly **one** non-deleted Jane Pulliam contact in CRM (or one obvious keeper + losers trashed/merged).
- [ ] Notes list shows **Mar 2026** Premium HSA / Previous Secure HSA notes (search “Premium HSA”).
- [ ] Note count on keeper ≥ sum of pre-merge duplicates (minus dedupes).
- [ ] ✨ Suggest works on a test field (no `AI_NOT_CONFIGURED`).
- [ ] Client told: Apr **2025** vs Apr **2026** eff date distinction.

---

## Part E — Follow-up code (optional, not blocking)

To reduce recurrence for other members with duplicate Zoho contacts:

- Extend `apps/crm/src/lib/crm/note-aggregate.ts` → `resolvePersonNoteSources` to include **same-email sibling contacts** in the org (with guard: same normalized email + contacts module only).
- Track in a GitHub issue; needs RLS test matrix (no cross-tenant reads).

---

## Rollback

| Action | Rollback |
|--------|----------|
| Merge | Use CRM trash/restore if merge is soft-delete; else restore from backup |
| Note `UPDATE record_id` | Reverse UPDATE with saved loser/keeper ids |
| `recover_zoho_notes_for_org` | Delete inserted notes by `created_at` window + staging batch id if tagged |
| `OPENAI_API_KEY` | Remove env var + redeploy (AI buttons fail closed again) |

---

## Approval gate

Before **B2–B4** (merge, note moves, recovery against prod):

> I have completed read-only discovery (Part A), designed merge + recovery, and prepared rehearsal SQL. Production writes are required. Please explicitly confirm before proceeding.

---

## References in repo

- Import notes RPC: `supabase/migrations_archive/202605110001_recover_zoho_notes_rpc.sql`
- Recovery script: `scripts/recover-zoho-notes.ts`
- Note aggregation (today): `apps/crm/src/lib/crm/note-aggregate.ts`
- AI routes: `apps/crm/src/app/api/crm/ai/field-suggest/route.ts`, `email-draft/route.ts`
- Zoho export evidence: `docs/_clean/supabase/notes.jsonl` (grep `Jane Pulliam`)
