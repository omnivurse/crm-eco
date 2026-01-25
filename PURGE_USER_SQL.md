# Direct SQL Method to Purge Deleted Users

Since the Edge Function needs to be deployed, here's a direct SQL method you can use immediately in the Supabase SQL Editor.

## Method 1: Via Supabase Dashboard (Easiest)

1. **Go to Supabase Dashboard**
2. **Navigate to: Authentication → Users**
3. **Click the "Show deleted users" toggle** at the top
4. **Find your deleted user**
5. **Click the three dots → "Delete permanently"**
6. **Confirm the deletion**

This will hard-delete the user and free up the email.

---

## Method 2: Via SQL Editor

If you prefer SQL, go to **SQL Editor** in your Supabase Dashboard and run:

```sql
-- Replace 'user@example.com' with the actual email address
DO $$
DECLARE
    user_record RECORD;
BEGIN
    -- Find all soft-deleted users with this email
    FOR user_record IN
        SELECT id, email, deleted_at
        FROM auth.users
        WHERE email = 'user@example.com'  -- CHANGE THIS EMAIL
        AND deleted_at IS NOT NULL
    LOOP
        -- Log what we're about to delete
        RAISE NOTICE 'Permanently deleting user: % (deleted at: %)',
            user_record.email,
            user_record.deleted_at;

        -- Permanently delete the user
        DELETE FROM auth.users WHERE id = user_record.id;

        RAISE NOTICE 'User % has been permanently deleted', user_record.email;
    END LOOP;

    -- Check if any users were found
    IF NOT FOUND THEN
        RAISE NOTICE 'No deleted users found with that email address';
    END IF;
END $$;
```

**Replace** `'user@example.com'` with the actual email of the deleted super admin.

---

## Method 3: Find User ID First, Then Delete

If you know the user ID:

```sql
-- Find soft-deleted users
SELECT id, email, deleted_at
FROM auth.users
WHERE deleted_at IS NOT NULL
ORDER BY deleted_at DESC;

-- Once you have the ID, permanently delete:
DELETE FROM auth.users WHERE id = 'USER_ID_HERE';
```

---

## Method 4: Using Supabase REST API

If you have access to make API calls (like from Postman or curl):

```bash
# Get your service role key from Supabase Dashboard → Settings → API

# List users (including deleted)
curl -X GET 'https://YOUR_PROJECT.supabase.co/auth/v1/admin/users' \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "apikey: YOUR_SERVICE_ROLE_KEY"

# Hard delete a user
curl -X DELETE 'https://YOUR_PROJECT.supabase.co/auth/v1/admin/users/USER_ID?should_soft_delete=false' \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "apikey: YOUR_SERVICE_ROLE_KEY"
```

---

## Recommended: Dashboard Method (Method 1)

The **easiest and safest** way is Method 1:
1. Go to Authentication → Users
2. Toggle "Show deleted users"
3. Find your user
4. Delete permanently

This is the official Supabase UI and has safety checks built in.

---

## After Purging

Once the user is purged:
1. The email is immediately available
2. You can create a new user with the same email
3. All authentication restrictions are lifted

---

## To Deploy the Edge Function Later

When you're ready to deploy the edge function for the UI button:

```bash
# From your local machine (not StackBlitz)
supabase functions deploy admin-purge-deleted-users
```

The function is already written and ready - it just needs to be deployed to your Supabase project.
