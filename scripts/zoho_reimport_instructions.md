# Zoho Re-Import Instructions

## Strategy: Full Export + Idempotent Re-Import

**Chosen strategy:** OPTION B — Full dataset export, rely on repaired dedup logic.

**Why full export is safer:**
- The repaired `upsert_contacts_batch()` has 4-tier dedup matching:
  1. Email match
  2. Zoho Record ID match (`data->>'zoho_record_id'`)
  3. Source Record ID match (`source_record_id` column)
  4. Name + phone match
- A delta export from Zoho risks missing records that were *modified* after the cutoff but *created* before it
- Full export ensures no records are missed, and dedup prevents double-creation
- The pipeline is idempotent: existing records get updated, new records get inserted

## Step-by-Step Process

### 1. Export from Zoho CRM

1. Log into Zoho CRM
2. Go to **Setup** > **Data Administration** > **Export**
3. Select **Contacts** module
4. Export **All Records** (do NOT apply a date filter)
5. Export as CSV
6. Save the file

### 2. Verify the CSV

Before importing, verify:
- The CSV has headers matching the original import columns
- The CSV includes a `Record Id` column (Zoho's internal ID)
- The CSV is UTF-8 encoded
- Row count looks reasonable compared to original import

### 3. Load into Staging

Upload the CSV to the `import_contacts_staging` table. This can be done via:
- The CRM import wizard at `/crm/import`
- Direct Supabase table import

### 4. Run the Import

Execute the repaired `upsert_contacts_batch()` function:

```sql
-- Run in batches of 500 (adjust as needed)
SELECT * FROM upsert_contacts_batch(0, 500);
SELECT * FROM upsert_contacts_batch(500, 500);
SELECT * FROM upsert_contacts_batch(1000, 500);
-- Continue until all rows are processed
```

Each call returns: `(inserted, updated, skipped, errors)`

### 5. Post-Import Verification

Run these queries after import:

```sql
-- How many records were added since the original cutoff?
SELECT count(*) AS new_records_since_feb10
FROM crm_records
WHERE created_at >= '2026-02-10'::date;

-- Check for duplicate spikes
SELECT title, email, count(*)
FROM crm_records
WHERE org_id = (SELECT id FROM organizations LIMIT 1)
GROUP BY title, email
HAVING count(*) > 2
ORDER BY count(*) DESC
LIMIT 20;

-- Normalization status after import
SELECT normalization_status, count(*)
FROM crm_records
GROUP BY normalization_status
ORDER BY count(*) DESC;

-- Market type distribution after import
SELECT market_type, count(*)
FROM crm_records
GROUP BY market_type
ORDER BY count(*) DESC;
```

### 6. Run Carrier Backfill on New Records

After import, re-run the carrier backfill for any new records that don't yet have carrier_id:

```sql
-- Exact match
UPDATE crm_records r
SET carrier_id = ic.id
FROM insurance_carriers ic
WHERE r.carrier_id IS NULL
  AND r.data->>'carrier' IS NOT NULL
  AND NULLIF(TRIM(r.data->>'carrier'), '') IS NOT NULL
  AND ic.organization_id = r.org_id
  AND LOWER(TRIM(r.data->>'carrier')) = LOWER(TRIM(ic.carrier_name));
```

## Expected Behavior

| Scenario | What Happens |
|----------|-------------|
| Record exists (matched by email or Zoho ID) | Updated with latest data, canonical fields preserved |
| Record is new (no match found) | Inserted with market_type, canonical ownership, normalization_status |
| Record has staff-corrected values | COALESCE logic preserves existing canonical values |
| Ambiguous record | normalization_status = 'needs_review' |

## Rollback

If something goes wrong:
- The import does NOT delete any existing records
- The import only INSERTs new rows or UPDATEs existing ones
- Raw JSONB data is always preserved
- To undo new inserts: `DELETE FROM crm_records WHERE import_source = 'zoho_csv' AND created_at > '<import_timestamp>'`
