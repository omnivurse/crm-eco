-- ============================================================================
-- Phase 6a-2 of the CRM undo-delete system: exclude trashed rows from the
-- crm_records email/name uniqueness index.
--
--   Problem: idx_crm_records_unique_email (202607090004) enforces uniqueness on
--   (org_id, module_id, email, first_name, last_name) but its partial predicate
--   does NOT exclude soft-deleted rows. Once soft-delete shipped (Phase 1), a
--   TRASHED record kept occupying its (email + name) slot, so re-creating that
--   same person — or a merge loser sitting in Trash — hit 23505 (mapped to a
--   generic 409) and stayed blocked for the entire 30-day retention window,
--   even though the record is invisible everywhere else.
--
--   Fix: add `deleted_at IS NULL` to the predicate. A trashed record frees its
--   uniqueness slot; a live re-create succeeds. This is the standard soft-delete
--   + partial-unique-index pattern.
--
-- Safety:
--   * The new predicate is strictly NARROWER than the old (a subset of the same
--     rows), so uniqueness held before => it holds now; the CREATE cannot fail
--     on current data. All currently-live rows have deleted_at IS NULL, so the
--     live namespace is unchanged.
--   * No ON CONFLICT arbiter infers this index — the only email ON CONFLICT
--     (sync_member_to_crm, 202606170001) targets a 3-column spec that already
--     doesn't match this 5-column index, and record creation uses a plain INSERT
--     that catches 23505. So narrowing the predicate breaks no upsert path.
--   * DROP + CREATE inside one migration transaction keeps the constraint gap-
--     free (other sessions see the old index until commit, the new one after).
--     lock_timeout='4s' fails fast rather than queueing behind traffic — the
--     same prod-rehearsed pattern used by 202606170001 and 202607090004.
--
-- Companion (app layer): the two crm_records restore routes now translate a
-- 23505 into a friendly 409. Freeing the slot means restoring a trashed record
-- AFTER its (email + name) was re-created by a new live record would re-collide;
-- the restore now reports that clearly instead of a raw 500.
--
-- Intentionally NOT touched: crm_records_members_source_uniq (the members-sync
-- source_id index) — it backs the member-sync ON CONFLICT and is coupled to the
-- deferred mirror-sync (Phase 5c) work; changing it needs that lifecycle first.
-- ============================================================================

SET lock_timeout = '4s';
SET statement_timeout = '0';

DROP INDEX IF EXISTS idx_crm_records_unique_email;

CREATE UNIQUE INDEX idx_crm_records_unique_email
  ON crm_records (
    org_id,
    module_id,
    lower(email),
    lower(btrim(coalesce(data->>'first_name', ''))),
    lower(btrim(coalesce(data->>'last_name', '')))
  )
  WHERE email IS NOT NULL
    AND email <> ''
    AND (system->>'source_table') IS DISTINCT FROM 'members'
    AND deleted_at IS NULL;

COMMENT ON INDEX idx_crm_records_unique_email IS
  'Per org+module uniqueness on email + first/last name (not email alone), so family members (e.g. a child dependent) can share one email; exact same-email+same-name is still blocked. Members-sourced records are exempt (deduped by source_id). Excludes soft-deleted (trashed) rows so a trashed record frees its email/name slot for re-creation (Phase 6a-2).';
