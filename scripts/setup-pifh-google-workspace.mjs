#!/usr/bin/env node
/**
 * PIFH Google Workspace setup checklist (manual steps — cannot be automated here).
 *
 * MX strategy: Google Workspace owns root @payitforwardhealth.com MX for staff
 * mailboxes. Resend inbound stays on mail.payitforwardhealth.com for platform aliases.
 *
 * Usage: node scripts/setup-pifh-google-workspace.mjs
 */

const STAFF_MAILBOXES = ['wendy@payitforwardhealth.com'];

const FORWARD_TO_CRM = [
  'support@payitforwardhealth.com',
  'billing@payitforwardhealth.com',
  'info@payitforwardhealth.com',
  'contact@payitforwardhealth.com',
  'privacy@payitforwardhealth.com',
  'compliance@payitforwardhealth.com',
  'legal@payitforwardhealth.com',
  'admin@payitforwardhealth.com',
];

console.log(`
PIFH Google Workspace Setup Checklist
=====================================

1. Google Admin (admin.google.com) → Add domain payitforwardhealth.com
2. Verify domain ownership (TXT record)
3. Set MX records on root domain to Google (as instructed by Google)
   - This enables staff mailboxes on root domain
   - Resend inbound for platform mail uses mail.payitforwardhealth.com (already configured)

4. Create user mailboxes:
${STAFF_MAILBOXES.map((e) => `   - ${e}`).join('\n')}

5. Optional: Create Google Groups or aliases for monitored addresses, OR rely on
   Resend inbound → email-intake → Admin/CRM inbox for:
${FORWARD_TO_CRM.map((e) => `   - ${e}`).join('\n')}

6. For wendy@: enable "Send mail as" aliases in Gmail if she should reply from
   membership@ or support@ via Google (optional; CRM/Admin compose also supports this).

7. After MX cutover, send a test to wendy@ from an external account and confirm delivery.

Resend inbound webhook (already created):
  https://sffisarikcreyyjzdjvb.supabase.co/functions/v1/email-intake

Set Supabase Edge Function secrets:
  RESEND_INBOUND_WEBHOOK_SECRET=<signing secret from Resend inbound webhook create>
  DEFAULT_ORG_ID=00000000-0000-0000-0000-000000000001
  INTAKE_MODE=inbox
`);
