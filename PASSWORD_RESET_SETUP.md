# Password Reset Setup Guide

## Overview

The forgot password feature has been implemented on all login pages:
- Staff Login (`/login/staff`)
- Advisor Login (`/login/advisor`)
- Main Login (`/login`)

However, password reset emails **require SMTP configuration** in Supabase to work.

---

## Current Status

✅ **Frontend Implemented**: All login pages have "Forgot your password?" functionality
✅ **Reset Page Created**: `/reset-password` page handles password updates
✅ **Token Validation**: Secure token-based reset flow
❌ **SMTP Not Configured**: Email delivery not set up in Supabase

---

## Required: Configure SMTP in Supabase

### Step 1: Access Supabase Dashboard

1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to **Project Settings** → **Auth**

### Step 2: Configure SMTP Settings

Scroll to the **SMTP Settings** section and enter:

```
SMTP Host: smtp.resend.com
SMTP Port: 465 (SSL) or 587 (TLS)
SMTP User: resend
SMTP Password: re_2QSQ6AC2_2aRDK4Xz7SStprBp7R9Hzmy5
Sender Email: noreply@yourdomain.com (must be verified in Resend)
Sender Name: MPB Health
```

### Step 3: Verify Sender Email

1. Log in to Resend (https://resend.com/domains)
2. Add and verify your domain OR use Resend's sandbox email
3. Update the "Sender Email" in Supabase with the verified address

### Step 4: Test Password Reset

1. Go to any login page
2. Click "Forgot your password?"
3. Enter a valid user email
4. Check email inbox for reset link
5. Click link and set new password

---

## Alternative: Direct Password Reset (Admin Use)

If you need to reset a password immediately without SMTP, use the database utility function:

### For vrt@mympb.com:

```sql
-- Run this in Supabase SQL Editor
SELECT reset_user_password('vrt@mympb.com', 'NewPassword123!');
```

### For any user:

```sql
-- Replace with actual email and desired password
SELECT reset_user_password('user@example.com', 'NewPassword123!');
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset successfully",
  "user_id": "uuid-here",
  "email": "user@example.com"
}
```

---

## How Password Reset Works

### User Flow:

1. **User clicks "Forgot your password?"** on login page
2. **User enters email** and clicks "Send Reset Link"
3. **Supabase sends email** with secure token (requires SMTP)
4. **User clicks link** in email → redirected to `/reset-password?token=...`
5. **User enters new password** (must be 8+ characters and match confirmation)
6. **Password updated** → auto-redirect to login after 3 seconds

### Security Features:

- ✅ Token-based authentication (single-use tokens)
- ✅ Token expiration (typically 1 hour)
- ✅ Password strength validation (8+ characters)
- ✅ Password confirmation matching
- ✅ HTTPS required in production
- ✅ No password visible in URL or logs

---

## Error Messages

### "Failed to send reset email. Please check your email address."

**Cause:** SMTP not configured OR invalid email address

**Solution:**
1. Configure SMTP in Supabase (see above)
2. Verify email exists in system
3. Check Supabase logs for detailed error

### "Invalid or expired reset link"

**Cause:** Token expired or already used

**Solution:**
1. Request a new password reset
2. Use the link within 1 hour
3. Each link can only be used once

---

## Email Template Customization (Optional)

To customize the password reset email:

1. Go to Supabase Dashboard → **Authentication** → **Email Templates**
2. Select "Reset Password" template
3. Customize the HTML and text
4. Available variables:
   - `{{ .Token }}` - Reset token
   - `{{ .SiteURL }}` - Your site URL
   - `{{ .TokenHash }}` - Token hash
   - `{{ .RedirectTo }}` - Redirect URL after reset

---

## Testing Checklist

After configuring SMTP:

- [ ] Test password reset on Staff Login
- [ ] Test password reset on Advisor Login
- [ ] Test password reset on Main Login
- [ ] Verify email arrives in inbox
- [ ] Click email link and reset password
- [ ] Login with new password
- [ ] Test expired/invalid token handling
- [ ] Test password mismatch validation
- [ ] Test password length requirement

---

## Troubleshooting

### Emails not arriving

1. Check spam/junk folder
2. Verify SMTP credentials in Supabase
3. Verify sender email is verified in Resend
4. Check Supabase Auth logs for errors
5. Test SMTP connection in Resend dashboard

### 500 Error from Supabase

**Cause:** SMTP not configured

**Solution:** Configure SMTP settings (see Step 2 above)

### Rate Limiting

Supabase limits password reset requests to prevent abuse:
- Maximum 1 request per 60 seconds per email
- If limit reached, user sees same success message (security feature)

---

## Security Best Practices

1. **Always use HTTPS** in production (prevents token interception)
2. **Set short token expiration** (1 hour recommended)
3. **Implement rate limiting** (already handled by Supabase)
4. **Monitor reset attempts** (check Supabase logs for abuse)
5. **Use strong password requirements** (8+ characters minimum)
6. **Log password changes** (audit trail for security)

---

## Support

For issues or questions:
- Supabase Auth Docs: https://supabase.com/docs/guides/auth
- Resend Docs: https://resend.com/docs
- SMTP Configuration: https://supabase.com/docs/guides/auth/auth-smtp
