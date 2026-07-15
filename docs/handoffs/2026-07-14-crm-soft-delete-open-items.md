# CRM undo-delete (soft-delete) — review notes & open items

**Date:** 2026-07-14
**Feature:** "CRM undo-delete Phase 1: soft-delete + Trash + Undo for records"
**Landed in:** commit `fd43ea91` (on `main`, pushed to `origin/main`)
**Reviewed by:** a separate session while the feature was mid-flight — this note is the handoff so findings survive session churn.

> Snapshot caveat: written just after `fd43ea91`. Verify against current `main` before acting — line numbers drift.

---

## ✅ Resolved during development (don't re-investigate)

- **Migration version collision.** Earlier there were two `202607140002_*` files (identity-cleanup vs soft-delete). Now renumbered cleanly with no duplicate prefixes:
  - `202607140002_contacts_identity_field_cleanup.sql`
  - `202607140003_crm_records_soft_delete.sql`
  - `202607140004_crm_search_exclude_trashed.sql`
- **Main read-paths hide trashed records.** `deleted_at IS NULL` filters are in `apps/crm/src/lib/crm/queries.ts` (list `getRecords` ~L540, single-record fetch ~L879/899, and ~L1268), plus `api/crm/records/bulk/route.ts`.
- **Global search hides trashed records** via `202607140004_crm_search_exclude_trashed.sql` — a signature-preserving `CREATE OR REPLACE` of the `crm_smart_search` RPCs that adds `AND r.deleted_at IS NULL`. The search route (`api/crm/search/route.ts`) uses that RPC as its primary path.
- **Migration deps exist:** `is_crm_member` / `has_crm_role` are defined in `00000000000000_baseline.sql`; `crm_records` carries both `organization_id` and `org_id` (the RPCs `coalesce` them).

---

## 🔧 Still open — verify / finish

1. **🟠 Search ilike-fallback path is unfiltered.**
   `apps/crm/src/app/api/crm/search/route.ts` falls back to direct `.from('crm_records')` selects (~L334 and ~L389) when the `crm_smart_search` RPC errors. Those selects have **no** `deleted_at IS NULL` filter, so a trashed record can resurface in search results whenever the RPC path fails. Add `.is('deleted_at', null)` to both fallback selects.

2. **🟡 Trash-batch ledger not updated on single-record restore/purge.**
   In `supabase/migrations/202607140003_crm_records_soft_delete.sql`:
   - `crm_restore_batch` correctly sets `crm_trash_batches.restored_at` (L195–197).
   - `crm_restore_record` (L203) and `crm_purge_record` (L234) flip/delete the record but **don't** touch `crm_trash_batches` (no `restored_at` / `purged_at`, no `item_count` adjustment). Single-record actions leave the batch row stale — a batch can still read as "un-restored/full count" after all its members were restored/purged individually. Fine for Phase 1 if intentional; note it or reconcile.

3. **🟡 Migration-rename drift (verify only).**
   The identity-cleanup migration was renamed across pushed history (`…140001 → …140002`), and soft-delete/search-exclude were renumbered too. If any environment (teammate local, CI, preview/staging) applied an **older** file number before the rename, its `supabase_migrations` ledger records a version whose file no longer exists → drift, and the renamed file re-applies as "new." Confirm nothing applied the pre-rename numbers, and that the SQL is idempotent if it does re-run. (Local/dev that never applied the old numbers is unaffected.)

---

## Not part of this feature (parked in the same working tree during dev)
These were interleaved edits from other efforts — listed so they aren't mistaken for soft-delete work: coverage-snapshot hero redesign (`DynamicRecordForm.tsx`), table height / double-scrollbar fix (`globals.css --crm-view-offset`, `RecordTable.tsx`, `NeedsTable.tsx`, `activity-table.tsx`, `ModuleHeader.tsx`), and the notes-count dedup (`record-insights.ts`, commit `c734c707`).
