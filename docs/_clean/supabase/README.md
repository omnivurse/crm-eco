# CRM-Eco Supabase Ingestion Bundle

Generated: 2026-05-11T23:12:51

Source data lives one directory up in `_clean/` (the consolidated outputs).
This folder contains everything needed to load that data into Supabase.

## What's here

```
00_schema.sql             DDL: zoho_import schema + 4 staging tables + indexes + a view
01_leads.sql              1,090 INSERTs for leads
02_contacts_part*.sql     14,412 INSERTs for contacts (chunked)
03_notes_part*.sql        99,832 INSERTs for notes (chunked)
04_unified_people.sql     15,448 INSERTs for the unified people view
copy_load.sql             psql \copy variant (recommended for notes — much faster)

leads.csv                 CSVs with header rewritten to SQL idents
contacts.csv              (paired with copy_load.sql)
notes.csv
unified_people.csv

leads.jsonl               JSONL for streaming inserts via Supabase JS / pg_loader
contacts.jsonl
notes.jsonl
unified_people.jsonl
```

## Design choices

- **Staging schema, not your canonical tables.** We load into `zoho_import.*` so
  you can write `INSERT ... SELECT` from there into your real CRM-Eco tables
  with full control over column mapping, RLS, and `organization_members`
  tenant assignment. This avoids forcing assumptions about your production schema.
- **Everything TEXT except timestamps, booleans, and a few numerics.** Zoho
  exports are messy; cast in the projection step into your canonical tables.
- **Primary keys preserved.** `record_id` on leads/contacts, `note_record_id`
  on notes — these are the Zoho IDs and are unique post-dedupe.
- **`person_record_id` on notes** is the parent (lead OR contact) Record Id;
  `person_type` is `'lead'` or `'contact'`. Use these to join.

## Three ways to load (pick one)

### Option A — Supabase SQL Editor (small/medium data)
Paste each file's contents into the SQL Editor and run in order:
  1. `00_schema.sql`
  2. `01_leads.sql`
  3. `02_contacts_part01.sql` ... `02_contacts_partNN.sql`
  4. `03_notes_part01.sql`    ... `03_notes_partNN.sql`
  5. `04_unified_people.sql`

The 99k notes will be the slow part — expect ~5-10 min total.

### Option B — psql + \copy (FASTEST, recommended)
Get your Supabase connection string from Project Settings → Database → Connection
String → URI. Then:

```bash
cd "/Users/qloudagent/Desktop/CRM DATA/_clean/supabase"
psql "$SUPABASE_DB_URL" -f 00_schema.sql
psql "$SUPABASE_DB_URL" -f copy_load.sql
```

Note: `\copy` runs CLIENT-side and uploads the file, so it works on Supabase
hosted Postgres. Should complete in under a minute for the entire dataset.

### Option C — Supabase JS client (programmatic)
Stream the JSONL files into `supabase.from('zoho_import.leads').upsert(...)`,
etc. Useful if you want to transform-on-the-fly into your canonical tables.

```ts
import { createReadStream } from 'node:fs';
import readline from 'node:readline';

const rl = readline.createInterface({ input: createReadStream('contacts.jsonl') });
const batch: any[] = [];
for await (const line of rl) {
  batch.push(JSON.parse(line));
  if (batch.length >= 500) {
    await supabase.schema('zoho_import').from('contacts').upsert(batch);
    batch.length = 0;
  }
}
if (batch.length) await supabase.schema('zoho_import').from('contacts').upsert(batch);
```

## After loading — projecting into canonical CRM-Eco tables

This bundle deliberately doesn't touch your real `leads` / `contacts` / `notes`
tables. Once `zoho_import.*` is populated, run something like:

```sql
-- Example: project contacts into your canonical table, assigning to an org
INSERT INTO public.contacts (id, organization_id, first_name, last_name, email, phone, mobile, status, source_record_id, created_at, ...)
SELECT
  gen_random_uuid(),
  '<your-org-uuid>',
  first_name,
  last_name,
  email,
  phone,
  mobile,
  contact_status,
  record_id,
  created_time,
  ...
FROM zoho_import.contacts
ON CONFLICT (source_record_id) DO UPDATE SET ...;
```

Same pattern for leads and notes. Notes get parented by joining
`zoho_import.notes.person_record_id` against the canonical table on
`source_record_id`.

## Counts (for reconciliation)

| Entity | Rows | Source |
|---|---:|---|
| leads | 1,090 | leads_clean_dedup_against_contacts.csv |
| contacts | 14,412 | contacts_clean.csv |
| notes | 99,832 | all_notes_master.csv (lead + contact notes combined) |
| unified_people | 15,448 | unified_people.csv (contacts + leads w/o contact twin) |
