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

## ✅ Follow-up applied (later commit — closes residuals 1 & 3, plus a Phase-2 regression)

- **Search ilike-fallback now filtered.** `apps/crm/src/app/api/crm/search/route.ts` — both `phoneIlikeFallback` and `ilikeFallback` add `.is('deleted_at' as never, null)`, so trashed records stay out of search even when the `crm_smart_search` RPC falls back.
- **Notes-count sync preserved under Phase 2.** Phase 2 (`202607140005`) added `deleted_at` to `crm_notes`, and `getNotesForRecords` now filters it — which would have made `record-insights.ts` over-count (trashed notes) vs. the list, reopening the original sidebar/chip mismatch. Fixed: `countAggregatedNotes` now filters `deleted_at IS NULL` (single-source head count + multi-source dedup), and `lastInteractionFor` excludes trashed tasks/notes/attachments.
- **Migration-rename drift = benign.** `202607140002_contacts_identity_field_cleanup.sql` is idempotent — the `crm_fields` INSERT uses `ON CONFLICT (module_id, key) DO UPDATE` (L112) and the rest are UPDATEs, so a re-apply from any ledger drift produces the same end state with no error. Ledger reconciliation itself is the team's process (see commit `097f0a01`).

## 🔧 Still open — for the soft-delete owner

- **🟡 Trash-batch ledger not updated on single-record restore/purge.**
  In `supabase/migrations/202607140003_crm_records_soft_delete.sql`, `crm_restore_batch` sets `crm_trash_batches.restored_at` (L195–197), but `crm_restore_record` (L203) and `crm_purge_record` (L234) don't touch the ledger — single-record actions leave the batch row stale (reads "un-restored / full count" after all members were individually restored/purged). Cosmetic for Phase 1. **Deliberately not injected here:** it needs a new forward `CREATE OR REPLACE` migration, and a parallel session is actively adding soft-delete migrations — a competing migration risks a version collision. Fold it into the next soft-delete phase.

---

## Not part of this feature (parked in the same working tree during dev)
These were interleaved edits from other efforts — listed so they aren't mistaken for soft-delete work: coverage-snapshot hero redesign (`DynamicRecordForm.tsx`), table height / double-scrollbar fix (`globals.css --crm-view-offset`, `RecordTable.tsx`, `NeedsTable.tsx`, `activity-table.tsx`, `ModuleHeader.tsx`), and the notes-count dedup (`record-insights.ts`, commit `c734c707`).
