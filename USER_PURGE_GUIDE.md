# User Purge System - Quick Guide

## Problem

When you delete a user in Supabase, the email address gets "soft-deleted" and remains reserved in the auth system. This prevents you from creating a new user with the same email address, even though the user appears to be deleted.

**Error you see:** "Email already taken" when trying to re-create a deleted user.

## Solution

I've added a **"Purge Deleted Users"** feature that permanently removes soft-deleted users from Supabase Auth, freeing up their email addresses.

## How to Use

### Step 1: Deploy the Purge Function

First, deploy the new Supabase Edge Function:

```bash
# Using Supabase CLI
supabase functions deploy admin-purge-deleted-users

# Or manually in Supabase Dashboard:
# 1. Go to Edge Functions
# 2. Create new function: admin-purge-deleted-users
# 3. Copy code from: supabase/functions/admin-purge-deleted-users/index.ts
```

### Step 2: Access the Purge Tool

1. Log in as an **admin** or **super_admin**
2. Navigate to **Admin → User Management**
3. Click the yellow **"Purge Deleted"** button in the top right

### Step 3: Purge a Deleted User

1. In the modal, enter the **email address** of the deleted user
2. Click **"Purge Now"**
3. The system will:
   - Find all soft-deleted users with that email
   - Permanently delete them from Supabase Auth
   - Log the action in audit logs
   - Show success message

### Step 4: Re-create the User

After purging, you can now create a new user with that email address:

1. Click **"Create User"**
2. Enter the same email address
3. The user will be created successfully

## What Gets Purged

- Soft-deleted entries in `auth.users` table
- All associated auth metadata
- Session tokens and refresh tokens

## What Stays

- The `profiles` table entry is already deleted when you delete the user
- Audit logs showing the deletion and purge actions
- Any tickets or data linked to the old user ID (for historical records)

## Security

- **Admin/Super Admin Only**: Only admins can access this feature
- **Audit Logged**: Every purge action is logged with who did it and when
- **Permanent**: This action cannot be undone
- **Email-Specific**: Only purges the specific email you enter

## Technical Details

The purge function uses Supabase's Admin API with the `should_soft_delete=false` parameter to perform a **hard delete** instead of a soft delete.

```typescript
// Hard delete using should_soft_delete=false parameter
DELETE /auth/v1/admin/users/{userId}?should_soft_delete=false
```

## Troubleshooting

**"No deleted users found"**
- The user may not have been deleted yet
- The email may be spelled incorrectly
- The user may have already been purged

**"Unauthorized"**
- You must be logged in as admin or super_admin
- Your session may have expired - try logging out and back in

**"Failed to purge"**
- Check the Supabase Edge Function logs
- Verify the function is deployed
- Ensure your Supabase service role key is configured

## Example Workflow

```
1. Admin deletes user: daniel@mpbhealth.com
   ❌ User deleted from profiles table
   ⚠️  Email still reserved in auth.users (soft-deleted)

2. Admin tries to re-create daniel@mpbhealth.com
   ❌ Error: "Email already taken"

3. Admin clicks "Purge Deleted" button
   ✅ Enters: daniel@mpbhealth.com
   ✅ Clicks "Purge Now"
   ✅ Success: Deleted user purged

4. Admin creates new user: daniel@mpbhealth.com
   ✅ Success: User created with super_admin role
```

## Files Changed

- **New File**: `supabase/functions/admin-purge-deleted-users/index.ts` - Edge function for purging
- **Updated**: `src/pages/admin/UsersAdmin.tsx` - Added purge button and modal UI

## Need Help?

If you encounter issues:
1. Check Supabase Edge Function logs
2. Verify the function is deployed
3. Check the browser console for errors
4. Review audit logs for the purge action details
