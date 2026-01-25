# Email Service Setup Guide for MPB Health IT

## Overview

This guide explains how to configure email services for the MPB Health IT ticketing system. The system supports multiple email providers with automatic fallback to ensure reliable email delivery.

## Current System Status

✅ **Email Functions Ready**: All Edge Functions gracefully handle missing email configuration
✅ **Fallback Logic**: Multi-provider support with automatic failover
✅ **Ticket Notifications**: Automated emails for ticket updates, assignments, and replies
✅ **Admin Functions**: Password reset and email confirmation with email support

## Email Service Options

### Option 1: Resend (Recommended for Quick Setup)

**Best For**: Quick setup, simple integration, reliable delivery

**Free Tier**: 3,000 emails/month, 100 emails/day
**Paid Tier**: Starting at $20/month for 50,000 emails

#### Setup Steps:

1. **Sign Up for Resend**
   - Go to https://resend.com
   - Create an account
   - Verify your email address

2. **Generate API Key**
   - Navigate to **API Keys** in the dashboard
   - Click **Create API Key**
   - Name it "MPB Health Production"
   - Copy the API key (starts with `re_`)
   - **Important**: Save this key securely - you can't view it again

3. **Configure in Supabase**
   - Open your Supabase project dashboard
   - Go to **Project Settings** → **Edge Functions** → **Secrets**
   - Add a new secret:
     - **Key**: `RESEND_API_KEY`
     - **Value**: Your Resend API key (paste the `re_` key)
   - Click **Add secret**

4. **Verify Domain (Production)**
   - In Resend dashboard, go to **Domains**
   - Click **Add Domain**
   - Enter your domain (e.g., `mympb.com`)
   - Add the DNS records provided by Resend:
     ```
     TXT  @  v=spf1 include:resend.com ~all
     CNAME resend._domainkey  resend._domainkey.resend.com
     ```
   - Wait for verification (usually 5-15 minutes)

5. **Update FROM_EMAIL**
   - After domain verification, update the FROM_EMAIL secret
   - Go to **Edge Functions** → **Secrets**
   - Add or update:
     - **Key**: `FROM_EMAIL`
     - **Value**: `support@mympb.com` (or your verified email)

#### Testing Resend Setup:

```bash
# Test from command line
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer YOUR_RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "support@mympb.com",
    "to": "your-email@example.com",
    "subject": "Test Email",
    "html": "<p>This is a test email</p>"
  }'
```

---

### Option 2: AWS SES (Recommended for Production Scale)

**Best For**: High volume, lowest cost, maximum reliability

**Free Tier**: 62,000 emails/month (first 12 months)
**Paid Tier**: $0.10 per 1,000 emails after free tier

#### Setup Steps:

1. **Create AWS Account**
   - Go to https://aws.amazon.com
   - Sign up for AWS account
   - Navigate to **Amazon SES** service

2. **Verify Email Address**
   - In SES console, go to **Verified identities**
   - Click **Create identity**
   - Choose **Email address**
   - Enter `support@mympb.com`
   - Check email for verification link

3. **Request Production Access** (Important!)
   - By default, SES is in "Sandbox mode" (can only send to verified addresses)
   - Go to **Account dashboard**
   - Click **Request production access**
   - Fill out the form:
     - **Use case**: Transactional emails for IT ticketing system
     - **Expected send rate**: 100-500 emails/day
   - Approval usually takes 24 hours

4. **Create SMTP Credentials**
   - In SES console, go to **SMTP settings**
   - Click **Create SMTP credentials**
   - Save the **SMTP username** and **SMTP password**

5. **Configure in Supabase**
   - Go to Supabase Dashboard
   - Navigate to **Project Settings** → **Authentication** → **SMTP Settings**
   - Configure:
     - **SMTP Host**: `email-smtp.us-east-1.amazonaws.com` (adjust region)
     - **SMTP Port**: `587` (TLS)
     - **SMTP Username**: Your SES SMTP username
     - **SMTP Password**: Your SES SMTP password
     - **Sender Email**: `support@mympb.com`
     - **Sender Name**: `MPB Health Support`

6. **Add DNS Records for Domain**
   ```
   # SPF Record
   TXT  @  v=spf1 include:amazonses.com ~all

   # DKIM Records (provided by SES after domain verification)
   CNAME  xxx._domainkey  xxx.dkim.amazonses.com
   CNAME  yyy._domainkey  yyy.dkim.amazonses.com
   CNAME  zzz._domainkey  zzz.dkim.amazonses.com
   ```

---

### Option 3: Custom SMTP (Any Email Provider)

**Best For**: Using existing email infrastructure (Gmail, Outlook, custom mail server)

#### Supported Providers:

| Provider | SMTP Host | Port | Notes |
|----------|-----------|------|-------|
| Gmail | smtp.gmail.com | 587 | Requires app password |
| Outlook | smtp-mail.outlook.com | 587 | Use account password |
| SendGrid | smtp.sendgrid.net | 587 | Use API key as password |
| Mailgun | smtp.mailgun.org | 587 | Use SMTP credentials |

#### Gmail Setup Example:

1. **Enable 2FA and Generate App Password**
   - Go to https://myaccount.google.com/security
   - Enable **2-Step Verification**
   - Go to **App passwords**
   - Generate password for "Mail" application
   - Save the 16-character password

2. **Configure in Supabase**
   - Go to **Project Settings** → **Authentication** → **SMTP Settings**
   - Enter:
     - **SMTP Host**: `smtp.gmail.com`
     - **SMTP Port**: `587`
     - **SMTP Username**: `your-email@gmail.com`
     - **SMTP Password**: Your app password (no spaces)
     - **Sender Email**: `your-email@gmail.com`
     - **Sender Name**: `MPB Health Support`

**Note**: Gmail has sending limits:
- Free: 500 emails/day
- Workspace: 2,000 emails/day

---

## Email Configuration for Different Environments

### Development/Testing

```env
# Use default Supabase email (limited)
# No configuration needed - already works for auth emails
```

### Staging

```env
# Resend free tier
RESEND_API_KEY=re_your_api_key
FROM_EMAIL=noreply@mail.app.supabase.co
```

### Production

```env
# AWS SES (configured in Supabase dashboard via SMTP settings)
# Or Resend with verified domain
RESEND_API_KEY=re_your_production_key
FROM_EMAIL=support@mympb.com
```

---

## Email Templates Configuration

The system includes pre-configured email templates for:

✅ **Staff Reply Notifications**: When staff responds to tickets
✅ **Assignment Notifications**: When tickets are assigned
✅ **Priority Change Notifications**: When ticket priority changes
✅ **Password Reset**: Admin-initiated password resets
✅ **Email Confirmation**: Email verification confirmations

Templates are stored in the `email_templates` table and can be customized via:

```sql
-- Update template
UPDATE email_templates
SET
  subject = 'Your Custom Subject - #{{ticket_number}}',
  body_html = '<p>Your custom HTML template</p>',
  body_text = 'Your custom plain text template'
WHERE name = 'staff_reply_notification';
```

### Available Template Variables:

- `{{ticket_number}}` - 8-character ticket ID
- `{{ticket_subject}}` - Ticket subject line
- `{{ticket_status}}` - Current ticket status
- `{{ticket_priority}}` - Ticket priority level
- `{{requester_name}}` - Ticket requester's name
- `{{staff_name}}` - Staff member's name
- `{{assignee_name}}` - Assigned staff member
- `{{comment_body}}` - Comment text
- `{{old_priority}}` / `{{new_priority}}` - Priority changes

---

## Testing Email Delivery

### Test 1: Manual Email Send

1. Log in as admin/staff
2. Open any ticket
3. Click "Send Email" button
4. Enter test recipient
5. Send email
6. Check delivery in Edge Function logs

### Test 2: Staff Reply Notification

1. Create test ticket
2. Add non-internal comment as staff
3. Check `ticket_email_notifications` table:
   ```sql
   SELECT * FROM ticket_email_notifications
   ORDER BY created_at DESC LIMIT 10;
   ```
4. Verify email status is 'sent' or 'pending'

### Test 3: Assignment Notification

1. Create ticket
2. Assign to staff member
3. Check requester's email
4. Staff should receive in-app notification

### Test 4: Password Reset

1. Go to User Management
2. Click "Reset Password" for test user
3. Check Edge Function logs for email status
4. User should receive temporary password email

---

## Troubleshooting

### Error: "Email service not configured"

**Cause**: No email provider configured

**Solution**:
1. Add `RESEND_API_KEY` secret in Supabase, OR
2. Configure SMTP settings in Supabase dashboard

### Error: "Failed to send email"

**Causes & Solutions**:

1. **Invalid API Key**
   - Verify `RESEND_API_KEY` is correct
   - Check key hasn't expired
   - Regenerate key if needed

2. **Domain Not Verified**
   - Verify domain in Resend/SES dashboard
   - Check DNS records are configured
   - Wait for DNS propagation (up to 48 hours)

3. **Rate Limit Exceeded**
   - Resend free tier: 100 emails/day
   - Gmail: 500 emails/day
   - Consider upgrading plan

4. **SMTP Authentication Failed**
   - Double-check SMTP credentials
   - For Gmail, use app password (not account password)
   - Verify SMTP port (587 for TLS, 465 for SSL)

### Email Delivered to Spam

**Solutions**:

1. **Add SPF Record**
   ```
   TXT  @  v=spf1 include:_spf.supabase.co ~all
   ```

2. **Add DKIM Record**
   - Provided by email service provider
   - Usually a CNAME record

3. **Add DMARC Record**
   ```
   TXT  _dmarc  v=DMARC1; p=none; rua=mailto:dmarc@mympb.com
   ```

4. **Warm Up IP Address**
   - Start with low volume (10-20 emails/day)
   - Gradually increase over 2-3 weeks
   - Monitor bounce/spam rates

### Check Email Logs

**View Edge Function Logs**:
1. Go to Supabase Dashboard
2. Navigate to **Edge Functions** → **send-ticket-email**
3. Click **Logs** tab
4. Filter by time range
5. Look for errors or email send confirmations

**Check Notification Status**:
```sql
-- View recent email notifications
SELECT
  id,
  recipient_email,
  notification_type,
  status,
  error_message,
  created_at,
  sent_at
FROM ticket_email_notifications
ORDER BY created_at DESC
LIMIT 20;

-- Count by status
SELECT status, COUNT(*) as count
FROM ticket_email_notifications
GROUP BY status;
```

---

## Email Deliverability Best Practices

### 1. Authenticate Your Domain

✅ Add SPF record
✅ Configure DKIM signing
✅ Set up DMARC policy
✅ Verify domain ownership

### 2. Maintain Good Sending Reputation

✅ Start with low volume
✅ Monitor bounce rates (keep < 5%)
✅ Handle unsubscribes promptly
✅ Clean up invalid email addresses

### 3. Design Professional Emails

✅ Use responsive HTML templates
✅ Include plain text version
✅ Add unsubscribe link (for marketing)
✅ Use recognizable sender name
✅ Include company contact info

### 4. Monitor Email Metrics

- **Delivery Rate**: Should be > 95%
- **Open Rate**: Typical 15-25% for transactional
- **Bounce Rate**: Keep < 5%
- **Spam Complaints**: Keep < 0.1%

---

## Production Checklist

Before going live with email notifications:

- [ ] Email provider configured (Resend, SES, or custom SMTP)
- [ ] Domain verified and DNS records added
- [ ] SPF, DKIM, DMARC configured
- [ ] FROM_EMAIL set to verified sender address
- [ ] Templates customized with company branding
- [ ] Test emails sent successfully
- [ ] Email logs reviewed for errors
- [ ] Monitoring/alerting set up for failed emails
- [ ] Bounce handling configured
- [ ] Email volume limits understood and acceptable

---

## Support & Resources

### Documentation
- [Supabase Auth SMTP Settings](https://supabase.com/docs/guides/auth/auth-smtp)
- [Resend Documentation](https://resend.com/docs)
- [AWS SES Documentation](https://docs.aws.amazon.com/ses/)

### Contact
- For system issues: Open ticket in MPB Health IT
- For Resend support: support@resend.com
- For AWS SES support: AWS Support Console

---

## Summary

The MPB Health IT ticketing system is now configured with flexible email delivery options:

✅ **Automatic Fallback**: If primary provider fails, system tries alternatives
✅ **Graceful Degradation**: System works without email (shows temp passwords in UI)
✅ **Production Ready**: Multi-provider support for maximum reliability
✅ **Easy Setup**: Add `RESEND_API_KEY` secret to enable email delivery

**Quick Start**: Add Resend API key to start sending emails in under 5 minutes!
