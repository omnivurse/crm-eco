# Actuarial Submission Package

Complete package for submitting de-identified experience data to an actuarial firm for a funding adequacy opinion.

## Directory Structure

```
docs/actuarial/
├── README.md                              ← You are here
├── actuarial_submission_package_v3.md      ← Source document (markdown)
├── cover_email_template.md                 ← Cover email template (markdown)
├── generate-docx.mjs                       ← Word document generator script
├── export-csvs.mjs                         ← CSV data export script
├── apply-migration.mjs                     ← Direct SQL migration runner
├── push-fix-migration.mjs                  ← Migration pusher via Supabase API
└── output/                                 ← Generated files (gitignored)
    ├── PIF_Actuarial_Submission_Package_v3.docx
    ├── PIF_Cover_Email_Actuarial_Engagement.docx
    └── csv/
        ├── Dataset_0_Portfolio_Summary.csv
        ├── Dataset_1_Monthly_Experience_Summary.csv
        ├── Dataset_2_Needs_By_Type.csv
        ├── Dataset_3_Contribution_Adequacy.csv
        ├── Dataset_4_Age_Band_Loss_Experience.csv
        └── Dataset_5_Exposure_Development.csv
```

## Quick Start

### Step 1: Apply Fix Migration (Required Once)

A PostgreSQL type-casting fix is needed for the `ROUND()` function calls.

1. Open the Supabase SQL Editor:
   https://supabase.com/dashboard/project/sffisarikcreyyjzdjvb/sql/new

2. Paste the entire contents of:
   `supabase/migrations/202602190003_fix_round_casts.sql`

3. Click **Run**

### Step 2: Generate Word Documents

```bash
node docs/actuarial/generate-docx.mjs
```

Output:
- `output/PIF_Actuarial_Submission_Package_v3.docx`
- `output/PIF_Cover_Email_Actuarial_Engagement.docx`

### Step 3: Export CSV Data

```bash
# List available organizations
node docs/actuarial/export-csvs.mjs

# Export 24 months of data for a specific org
node docs/actuarial/export-csvs.mjs <org-id> 24
```

Output: `output/csv/*.csv`

### Step 4: Fill in Part 6 (Program Structure)

Open the Word document and fill in the red-highlighted bracketed items in Part 6:
- Waiting periods
- Pre-existing condition rules
- Maternity rules
- Maximum sharing limits
- Network/reference pricing
- Prescription sharing structure
- Membership eligibility requirements

### Step 5: Assemble the Send Package

```bash
# Zip the CSV files
cd docs/actuarial/output
zip -j PIF_Actuarial_Data_CSVs.zip csv/*.csv
```

**Final package to send:**
1. `PIF_Actuarial_Submission_Package_v3.docx` (convert to PDF recommended)
2. `PIF_Actuarial_Data_CSVs.zip`
3. Cover email text from `PIF_Cover_Email_Actuarial_Engagement.docx`

## Regenerating Data

The CSV export script calls the Supabase RPCs directly. Data is always live from production. To refresh:

```bash
node docs/actuarial/export-csvs.mjs <org-id> 24
```

## Alternative: Dashboard Export

You can also export CSVs from the admin dashboard:
1. Log in as owner/admin
2. Navigate to **Analytics > Actuarial Data**
3. Click **Export All CSVs**

## Related Migrations

| File | Purpose | Status |
|------|---------|--------|
| `202602190001_group_demographics_rpc.sql` | De-identified demographics dashboard | Applied |
| `202602190002_actuarial_experience_rpc.sql` | Actuarial experience data (5 datasets) | Applied |
| `202602190003_fix_round_casts.sql` | Fix ROUND() type casts for PostgreSQL | **Apply this** |
