# CRM-Eco Zoho Pipeline Bundle

Generated: 2026-05-11T23:22:27
Target: **PIFH org** (`00000000-0000-0000-0000-000000000001`) on **PIF-ECO-V2** Supabase project.

This bundle plugs into the existing Zoho import pipeline already in your
crm-eco repo — `import_contacts_staging` + `upsert_contacts_batch` for
contacts, `import_notes_staging` + `recover_zoho_notes_for_org` for notes —
and adds the missing leads counterpart (`import_leads_staging` +
`upsert_leads_batch`).

## What's here

```
migration/202605120001_zoho_leads_pipeline.sql   New migration (apply once)
csv/import_contacts_staging.csv                  14,412 rows, column names match the existing staging table
csv/import_leads_staging.csv                     1,036 rows (excludes 54 lead↔contact dupes)
csv/import_notes_staging.csv                     99,832 rows (lead + contact notes combined)
run_pipeline.sql                                 Full \copy + batched-upsert orchestrator
```

## Why this matters

- **Reuses everything that's already built.** The 4-tier dedup
  (`email` → `zoho_record_id` → `name+phone` → insert) in
  `upsert_contacts_batch` is exercised here. Re-running is idempotent.
- **Notes recovery uses today's new RPC.** `recover_zoho_notes_for_org` —
  added in `202605110001_recover_zoho_notes_rpc.sql` — matches notes to
  records via `crm_records.data->>'zoho_record_id'` with the `zcrm_` prefix
  tolerated on either side. Re-running cannot duplicate notes (±1 minute
  window dedup).
- **The 54 lead↔contact same-person duplicates are NOT loaded as leads.**
  They live in `lead_to_contact_matches.csv` (one level up) for manual
  audit. The contacts pipeline handles them as the canonical record.
- **`upsert_leads_batch` takes `p_org_id` explicitly** — follows the
  multi-tenant pattern from `recover_zoho_notes_for_org`, not the legacy
  `SELECT id FROM organizations LIMIT 1` pattern. Safe for Double Helix's
  future multi-tenant architecture.

## Run sequence

### Step 0 — Verify you're pointed at PIF-ECO-V2

```bash
supabase projects list   # confirm PIF-ECO-V2 (sffisarikcreyyjzdjvb) is ● LINKED
gh auth status           # confirm omnivurse is active
```

### Step 1 — Apply the new migration

Either drop the file into your repo and let CI/the Supabase migration
runner pick it up:

```bash
cp migration/202605120001_zoho_leads_pipeline.sql \
   /Users/qloudagent/Documents/GitHub/crm-eco/supabase/migrations/
cd /Users/qloudagent/Documents/GitHub/crm-eco
supabase db push
```

Or apply directly with psql:

```bash
psql "$SUPABASE_DB_URL" -f migration/202605120001_zoho_leads_pipeline.sql
```

### Step 2 — Run the pipeline

```bash
cd '/Users/qloudagent/Desktop/CRM DATA/_clean/supabase/pipeline'
psql "$SUPABASE_DB_URL" -f run_pipeline.sql
```

The script will:
1. TRUNCATE + \copy `import_contacts_staging` (14,412 rows)
2. Loop `upsert_contacts_batch(offset, 500)` until done
3. TRUNCATE + \copy `import_leads_staging` (1,036 rows)
4. Loop `upsert_leads_batch(offset, 500, p_org_id)` until done
5. TRUNCATE + \copy `import_notes_staging` (99,832 rows)
6. SELECT * FROM `recover_zoho_notes_for_org(p_org_id, NULL)`
7. Print verification counts

Expected runtime: ~2-5 minutes total against PIF-ECO-V2.

### Step 3 — Verify

The script prints counts at the end. They should be roughly:

| Metric | Expected |
|---|---:|
| Contacts in crm_records (module=contacts) | ≥ 14,412 |
| Leads in crm_records (module=leads) | ≥ 1,036 |
| Notes in crm_notes | depends on parent matches |

The notes count will be LESS than 99,832 because the 14,217 orphan
lead-notes (whose parent leads weren't in the WS-filtered export) can't
match any record. `recover_zoho_notes_for_org` returns the
`orphan_parent_count` so you'll see exactly how many didn't land.

## What's NOT here (you may want next)

- **Lead↔contact merge resolution.** The 54 duplicates are excluded from
  the leads load but otherwise untouched. If you want them auto-removed
  from `crm_records` (module=leads) where a contact twin exists, that's a
  separate cleanup query.
- **Suspected-duplicate auto-merge.** The 970 contact-dupe groups need
  manual review per the earlier consolidation summary.
- **Carrier backfill.** Per `scripts/zoho_reimport_instructions.md`, run
  the carrier backfill SQL after import for new records that lack
  `carrier_id`.

## Rollback

The pipeline only INSERTs and UPDATEs. To undo:

```sql
-- Delete contacts inserted by this run (using import_source if you've tagged it)
DELETE FROM crm_records
WHERE org_id = '00000000-0000-0000-0000-000000000001'
  AND module_id IN (SELECT id FROM crm_modules WHERE key IN ('contacts', 'leads'))
  AND created_at > '<your-run-timestamp>'::timestamptz;

-- Delete notes
DELETE FROM crm_notes
WHERE org_id = '00000000-0000-0000-0000-000000000001'
  AND created_at > '<your-run-timestamp>'::timestamptz;
```

Raw staging tables can be re-TRUNCATEd and re-loaded freely.
