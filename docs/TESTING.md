# CRM-ECO Testing Guide

## Quick Start

### 1. Set Up Test User

Since user creation requires the Supabase Dashboard:

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/ctujznwjyyqnhecixlon)
2. Sign in with your Supabase account
3. Navigate to **Authentication > Users**
4. Click **Add User** > **Create New User**
5. Enter:
   - Email: `admin@demo.com`
   - Password: `password123`
   - Check "Auto confirm email"
6. Click **Create User**
7. Copy the User UID (you'll need it for the profile)

### 2. Run Test Data Setup

1. Go to **SQL Editor** in Supabase Dashboard
2. Open `scripts/setup-test-data.sql`
3. Replace `USER_UUID_HERE` with the User UID from step 1
4. Run the entire script

### 3. Start the Application

```bash
cd apps/crm
npm run dev
```

### 4. Login

Go to http://localhost:3000 and sign in with:
- Email: `admin@demo.com`
- Password: `password123`

---

## Test Scenarios

### CSV Import Testing

1. Navigate to **Settings > Imports**
2. Create test CSV files:

**test-leads.csv:**
```csv
first_name,last_name,email,phone,state,source,campaign,status,household_size
Test,Lead One,testlead1@example.com,5551112222,FL,LegacyCRM,Test-Campaign,new,2
```

**test-members.csv:**
```csv
first_name,last_name,email,phone,state,date_of_birth,status
Jane,Doe,janedoe@example.com,5559998888,MA,1958-03-15,active
```

3. Upload and verify:
   - Import job shows "completed"
   - Row counts match
   - Entities appear in their respective lists

### Enrollment Testing

1. Navigate to **Enrollments**
2. Click **New Enrollment**
3. Select:
   - Member: Jane Smith (MA, DOB 1958)
   - Plan: Basic Health Share
   - Advisor: John Broker
   - Requested effective date: future date

4. Verify warnings appear:
   - ⚠️ Mandate State (MA is a mandate state)
   - ⚠️ 65+ Age Warning

5. Create the enrollment
6. Click on the enrollment to view details
7. Verify:
   - Enrollment steps are displayed
   - Audit log shows "Enrollment created"
   - Warning badges appear

### Role-Based Access Testing

| Feature | Owner/Admin | Advisor | Staff |
|---------|-------------|---------|-------|
| Dashboard | ✅ | ✅ | ✅ |
| Members | All | Their assigned | All |
| Advisors | All | Limited | All |
| Enrollments | All | Their assigned | All |
| Settings | ✅ | ❌ | ❌ |
| Imports | ✅ | ❌ | ❌ |
| Plans | ✅ | ❌ | ❌ |

---

## Database Tables Added (Phase 0.9)

### Import System
- `import_jobs` - Tracks CSV import operations
- `import_job_rows` - Per-row import results

### Enrollment Engine
- `plans` - Health share plans catalog
- `memberships` - Member-plan relationships
- `enrollments` - Enrollment journeys
- `enrollment_steps` - Wizard progress tracking
- `enrollment_audit_log` - Immutable audit trail

---

## Troubleshooting

### "Database error saving new user"
The demo organization might not exist. Run the SQL setup script first.

### "No profile found"
Profile wasn't created for the auth user. Manually insert via SQL:

```sql
INSERT INTO profiles (user_id, organization_id, email, display_name, role)
VALUES ('YOUR_AUTH_USER_ID', '00000000-0000-0000-0000-000000000001', 'admin@demo.com', 'Admin', 'owner');
```

### Import shows "error" for all rows
Check the import job rows for detailed error messages:

```sql
SELECT * FROM import_job_rows WHERE import_job_id = 'YOUR_JOB_ID';
```

