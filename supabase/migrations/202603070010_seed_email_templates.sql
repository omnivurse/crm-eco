-- ============================================================================
-- SEED EMAIL TEMPLATES FOR ALL EXISTING ORGANIZATIONS
-- Ensures every organization has pre-built email templates available
-- ============================================================================

-- Ensure the UNIQUE constraint exists (may be missing if table was created before the constraint was defined)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'email_templates_organization_id_slug_key'
      AND conrelid = 'email_templates'::regclass
  ) THEN
    ALTER TABLE email_templates ADD CONSTRAINT email_templates_organization_id_slug_key UNIQUE (organization_id, slug);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL; -- constraint might exist with a different name
END;
$$;

-- Drop restrictive check constraint on template_type so we can use descriptive type values
ALTER TABLE email_templates DROP CONSTRAINT IF EXISTS email_templates_template_type_check;

-- Drop the single-column name unique constraint (names should be unique per org, not globally)
ALTER TABLE email_templates DROP CONSTRAINT IF EXISTS email_templates_name_key;

-- Update the seed function with a comprehensive set of templates
CREATE OR REPLACE FUNCTION seed_default_email_templates(p_organization_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO email_templates (organization_id, name, slug, description, subject, body_html, body_text, template_type, is_system, available_variables)
  VALUES
    -- ===== WELCOME & ONBOARDING =====
    (p_organization_id, 'Welcome Email', 'welcome_email',
     'Sent to new members upon enrollment',
     'Welcome to {{organization_name}}!',
     '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #0f172a, #06b6d4); padding: 30px; border-radius: 8px 8px 0 0;">
    <h1 style="color: #fff; margin: 0; font-size: 24px;">Welcome, {{member_name}}!</h1>
  </div>
  <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">Thank you for enrolling with <strong>{{organization_name}}</strong>. We''re thrilled to have you as part of our community.</p>
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">Your coverage begins on <strong>{{effective_date}}</strong>.</p>
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">Your plan: <strong>{{plan_name}}</strong></p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
    <p style="color: #6b7280; font-size: 14px;">If you have any questions, please don''t hesitate to reach out to our support team.</p>
  </div>
</div>',
     'Welcome, {{member_name}}! Thank you for enrolling with {{organization_name}}. Your coverage begins on {{effective_date}}. Your plan: {{plan_name}}.',
     'welcome', true, '["member_name", "organization_name", "effective_date", "plan_name"]'::jsonb),

    -- ===== BILLING =====
    (p_organization_id, 'Payment Receipt', 'payment_receipt',
     'Sent after a successful payment is processed',
     'Payment Receipt - {{amount}}',
     '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #0f172a; padding: 30px; border-radius: 8px 8px 0 0;">
    <h1 style="color: #fff; margin: 0; font-size: 24px;">Payment Confirmation</h1>
  </div>
  <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">Hi {{member_name}},</p>
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">We''ve received your payment. Here are the details:</p>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr><td style="padding: 8px; color: #6b7280;">Amount</td><td style="padding: 8px; font-weight: bold; color: #374151;">{{amount}}</td></tr>
      <tr style="background: #f9fafb;"><td style="padding: 8px; color: #6b7280;">Date</td><td style="padding: 8px; color: #374151;">{{payment_date}}</td></tr>
      <tr><td style="padding: 8px; color: #6b7280;">Transaction ID</td><td style="padding: 8px; color: #374151;">{{transaction_id}}</td></tr>
    </table>
    <p style="color: #6b7280; font-size: 14px;">Thank you for your prompt payment.</p>
  </div>
</div>',
     'Hi {{member_name}}, we''ve received your payment of {{amount}} on {{payment_date}}. Transaction ID: {{transaction_id}}. Thank you!',
     'billing', true, '["member_name", "amount", "payment_date", "transaction_id"]'::jsonb),

    (p_organization_id, 'Payment Failed', 'payment_failed',
     'Sent when a payment attempt fails',
     'Action Required: Payment Failed',
     '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #dc2626; padding: 30px; border-radius: 8px 8px 0 0;">
    <h1 style="color: #fff; margin: 0; font-size: 24px;">Payment Failed</h1>
  </div>
  <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">Hi {{member_name}},</p>
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">We were unable to process your payment of <strong>{{amount}}</strong>.</p>
    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 15px; margin: 15px 0;">
      <p style="color: #991b1b; margin: 0; font-size: 14px;"><strong>Error:</strong> {{error_message}}</p>
    </div>
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">We will retry on <strong>{{retry_date}}</strong>. Please update your payment method to avoid disruption to your coverage.</p>
    <p style="color: #6b7280; font-size: 14px;">If you need assistance, contact our billing department.</p>
  </div>
</div>',
     'Hi {{member_name}}, we were unable to process your payment of {{amount}}. Error: {{error_message}}. We will retry on {{retry_date}}. Please update your payment method.',
     'billing', true, '["member_name", "amount", "error_message", "retry_date"]'::jsonb),

    (p_organization_id, 'Monthly Statement', 'monthly_statement',
     'Monthly billing summary sent to members',
     'Your Monthly Statement - {{statement_month}}',
     '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #0f172a; padding: 30px; border-radius: 8px 8px 0 0;">
    <h1 style="color: #fff; margin: 0; font-size: 24px;">Monthly Statement</h1>
    <p style="color: #9bd7d7; margin: 5px 0 0; font-size: 14px;">{{statement_month}}</p>
  </div>
  <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">Hi {{member_name}},</p>
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">Here is your monthly billing summary:</p>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr><td style="padding: 8px; color: #6b7280;">Plan</td><td style="padding: 8px; color: #374151;">{{plan_name}}</td></tr>
      <tr style="background: #f9fafb;"><td style="padding: 8px; color: #6b7280;">Monthly Premium</td><td style="padding: 8px; font-weight: bold; color: #374151;">{{amount}}</td></tr>
      <tr><td style="padding: 8px; color: #6b7280;">Next Payment Date</td><td style="padding: 8px; color: #374151;">{{next_payment_date}}</td></tr>
    </table>
    <p style="color: #6b7280; font-size: 14px;">Thank you for being a valued member of {{organization_name}}.</p>
  </div>
</div>',
     'Hi {{member_name}}, here is your monthly statement for {{statement_month}}. Plan: {{plan_name}}. Premium: {{amount}}. Next payment: {{next_payment_date}}.',
     'billing', true, '["member_name", "organization_name", "statement_month", "plan_name", "amount", "next_payment_date"]'::jsonb),

    -- ===== ENROLLMENT =====
    (p_organization_id, 'Enrollment Confirmation', 'enrollment_confirmation',
     'Sent when a member enrollment is confirmed',
     'Enrollment Confirmed - {{plan_name}}',
     '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #0f172a, #06b6d4); padding: 30px; border-radius: 8px 8px 0 0;">
    <h1 style="color: #fff; margin: 0; font-size: 24px;">Enrollment Confirmed!</h1>
  </div>
  <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">Hi {{member_name}},</p>
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">Your enrollment in <strong>{{plan_name}}</strong> has been confirmed.</p>
    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 15px; margin: 15px 0;">
      <p style="color: #166534; margin: 0 0 5px; font-size: 14px;"><strong>Coverage Start:</strong> {{effective_date}}</p>
      <p style="color: #166534; margin: 0; font-size: 14px;"><strong>Monthly Cost:</strong> {{monthly_cost}}</p>
    </div>
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">You can access your member portal at any time to view your benefits and coverage details.</p>
    <p style="color: #6b7280; font-size: 14px;">Welcome to the {{organization_name}} community!</p>
  </div>
</div>',
     'Hi {{member_name}}, your enrollment in {{plan_name}} has been confirmed! Coverage begins {{effective_date}}. Monthly cost: {{monthly_cost}}.',
     'enrollment', true, '["member_name", "plan_name", "effective_date", "monthly_cost", "organization_name"]'::jsonb),

    -- ===== COVERAGE CHANGES =====
    (p_organization_id, 'Cancellation Notice', 'cancellation_notice',
     'Sent when a member coverage is cancelled',
     'Coverage Cancellation Notice',
     '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #6b7280; padding: 30px; border-radius: 8px 8px 0 0;">
    <h1 style="color: #fff; margin: 0; font-size: 24px;">Cancellation Confirmed</h1>
  </div>
  <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">Hi {{member_name}},</p>
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">Your coverage has been cancelled effective <strong>{{termination_date}}</strong>.</p>
    <div style="background: #f3f4f6; border-radius: 6px; padding: 15px; margin: 15px 0;">
      <p style="color: #374151; margin: 0; font-size: 14px;"><strong>Reason:</strong> {{cancellation_reason}}</p>
    </div>
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">If you believe this was done in error or wish to re-enroll, please contact our support team.</p>
  </div>
</div>',
     'Hi {{member_name}}, your coverage has been cancelled effective {{termination_date}}. Reason: {{cancellation_reason}}. Contact us if you have questions.',
     'notification', true, '["member_name", "termination_date", "cancellation_reason"]'::jsonb),

    (p_organization_id, 'Annual Renewal Notice', 'annual_renewal',
     'Sent before annual coverage renewal',
     'Your Coverage Renewal is Coming Up',
     '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #0f172a, #06b6d4); padding: 30px; border-radius: 8px 8px 0 0;">
    <h1 style="color: #fff; margin: 0; font-size: 24px;">Renewal Reminder</h1>
  </div>
  <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">Hi {{member_name}},</p>
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">Your <strong>{{plan_name}}</strong> coverage is up for renewal on <strong>{{renewal_date}}</strong>.</p>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr><td style="padding: 8px; color: #6b7280;">Current Premium</td><td style="padding: 8px; color: #374151;">{{current_amount}}</td></tr>
      <tr style="background: #f9fafb;"><td style="padding: 8px; color: #6b7280;">New Premium</td><td style="padding: 8px; font-weight: bold; color: #374151;">{{new_amount}}</td></tr>
    </table>
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">No action is required if you wish to continue your coverage. If you have questions about plan options, please reach out.</p>
  </div>
</div>',
     'Hi {{member_name}}, your {{plan_name}} coverage renews on {{renewal_date}}. Current premium: {{current_amount}}. New premium: {{new_amount}}. No action needed to continue.',
     'notification', true, '["member_name", "plan_name", "renewal_date", "current_amount", "new_amount"]'::jsonb),

    -- ===== TEAM & ADVISOR =====
    (p_organization_id, 'Advisor Invitation', 'advisor_invitation',
     'Sent to invite a new advisor to the organization',
     'You''re Invited to Join {{organization_name}}',
     '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #0f172a, #06b6d4); padding: 30px; border-radius: 8px 8px 0 0;">
    <h1 style="color: #fff; margin: 0; font-size: 24px;">Join Our Team!</h1>
  </div>
  <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">Hi {{advisor_name}},</p>
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">{{inviter_name}} has invited you to join <strong>{{organization_name}}</strong> as an advisor.</p>
    <div style="text-align: center; margin: 25px 0;">
      <a href="{{signup_url}}" style="background: #06b6d4; color: #fff; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Accept Invitation</a>
    </div>
    <p style="color: #6b7280; font-size: 14px;">This invitation link will expire in 7 days.</p>
  </div>
</div>',
     'Hi {{advisor_name}}, {{inviter_name}} has invited you to join {{organization_name}} as an advisor. Click here to accept: {{signup_url}}',
     'invitation', true, '["advisor_name", "organization_name", "signup_url", "inviter_name"]'::jsonb),

    (p_organization_id, 'Team Member Invitation', 'team_invitation',
     'Sent to invite a new team member to the platform',
     'You''ve Been Invited to {{organization_name}}',
     '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #0f172a; padding: 30px; border-radius: 8px 8px 0 0;">
    <h1 style="color: #fff; margin: 0; font-size: 24px;">You''re Invited!</h1>
  </div>
  <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">Hi there,</p>
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">{{inviter_name}} has invited you to join <strong>{{organization_name}}</strong> as a <strong>{{role}}</strong>.</p>
    <div style="text-align: center; margin: 25px 0;">
      <a href="{{signup_url}}" style="background: #0f172a; color: #fff; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Accept Invitation</a>
    </div>
    <p style="color: #6b7280; font-size: 14px;">This invitation expires in 7 days. If you didn''t expect this invitation, you can safely ignore this email.</p>
  </div>
</div>',
     'You''ve been invited to join {{organization_name}} as a {{role}} by {{inviter_name}}. Accept here: {{signup_url}}',
     'invitation', true, '["organization_name", "inviter_name", "role", "signup_url"]'::jsonb),

    -- ===== NOTIFICATIONS =====
    (p_organization_id, 'Appointment Reminder', 'appointment_reminder',
     'Sent to remind members of upcoming appointments',
     'Appointment Reminder - {{appointment_date}}',
     '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #06b6d4; padding: 30px; border-radius: 8px 8px 0 0;">
    <h1 style="color: #fff; margin: 0; font-size: 24px;">Appointment Reminder</h1>
  </div>
  <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">Hi {{member_name}},</p>
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">This is a friendly reminder about your upcoming appointment:</p>
    <div style="background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 6px; padding: 15px; margin: 15px 0;">
      <p style="color: #0f766e; margin: 0 0 5px; font-size: 14px;"><strong>Date:</strong> {{appointment_date}}</p>
      <p style="color: #0f766e; margin: 0 0 5px; font-size: 14px;"><strong>Time:</strong> {{appointment_time}}</p>
      <p style="color: #0f766e; margin: 0; font-size: 14px;"><strong>With:</strong> {{provider_name}}</p>
    </div>
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">If you need to reschedule, please contact us as soon as possible.</p>
  </div>
</div>',
     'Hi {{member_name}}, reminder: your appointment is on {{appointment_date}} at {{appointment_time}} with {{provider_name}}. Contact us to reschedule.',
     'notification', true, '["member_name", "appointment_date", "appointment_time", "provider_name"]'::jsonb),

    (p_organization_id, 'Benefits Summary', 'benefits_summary',
     'Summary of member benefits and coverage details',
     'Your Benefits Summary - {{plan_name}}',
     '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #0f172a, #06b6d4); padding: 30px; border-radius: 8px 8px 0 0;">
    <h1 style="color: #fff; margin: 0; font-size: 24px;">Your Benefits Summary</h1>
  </div>
  <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">Hi {{member_name}},</p>
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">Here''s a summary of your current coverage under <strong>{{plan_name}}</strong>:</p>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr><td style="padding: 8px; color: #6b7280;">Member ID</td><td style="padding: 8px; color: #374151;">{{member_number}}</td></tr>
      <tr style="background: #f9fafb;"><td style="padding: 8px; color: #6b7280;">Plan</td><td style="padding: 8px; color: #374151;">{{plan_name}}</td></tr>
      <tr><td style="padding: 8px; color: #6b7280;">Effective Date</td><td style="padding: 8px; color: #374151;">{{effective_date}}</td></tr>
      <tr style="background: #f9fafb;"><td style="padding: 8px; color: #6b7280;">Monthly Premium</td><td style="padding: 8px; color: #374151;">{{monthly_cost}}</td></tr>
    </table>
    <p style="color: #6b7280; font-size: 14px;">For full coverage details, please log in to your member portal or contact {{organization_name}}.</p>
  </div>
</div>',
     'Hi {{member_name}}, here is your benefits summary. Plan: {{plan_name}}. Member ID: {{member_number}}. Effective: {{effective_date}}. Monthly Premium: {{monthly_cost}}.',
     'notification', true, '["member_name", "organization_name", "plan_name", "member_number", "effective_date", "monthly_cost"]'::jsonb),

    (p_organization_id, 'Password Reset', 'password_reset',
     'Sent when a user requests a password reset',
     'Reset Your Password',
     '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #0f172a; padding: 30px; border-radius: 8px 8px 0 0;">
    <h1 style="color: #fff; margin: 0; font-size: 24px;">Password Reset Request</h1>
  </div>
  <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">Hi {{member_name}},</p>
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">We received a request to reset your password. Click the button below to set a new password:</p>
    <div style="text-align: center; margin: 25px 0;">
      <a href="{{reset_url}}" style="background: #0f172a; color: #fff; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Reset Password</a>
    </div>
    <p style="color: #6b7280; font-size: 14px;">This link expires in 1 hour. If you didn''t request this, you can safely ignore this email.</p>
  </div>
</div>',
     'Hi {{member_name}}, click this link to reset your password: {{reset_url}}. This link expires in 1 hour.',
     'notification', true, '["member_name", "reset_url"]'::jsonb),

    (p_organization_id, 'Referral Thank You', 'referral_thank_you',
     'Sent to thank members for referring others',
     'Thank You for Your Referral!',
     '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #06b6d4, #059669); padding: 30px; border-radius: 8px 8px 0 0;">
    <h1 style="color: #fff; margin: 0; font-size: 24px;">Thank You!</h1>
  </div>
  <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">Hi {{member_name}},</p>
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">Thank you for referring <strong>{{referred_name}}</strong> to {{organization_name}}! Your recommendation helps us build a stronger, healthier community.</p>
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">We truly appreciate your support in helping others access quality healthcare coverage.</p>
    <p style="color: #6b7280; font-size: 14px;">Keep spreading the word — together we can make a difference!</p>
  </div>
</div>',
     'Hi {{member_name}}, thank you for referring {{referred_name}} to {{organization_name}}! Your support helps build a healthier community.',
     'notification', true, '["member_name", "referred_name", "organization_name"]'::jsonb),

    -- ===== GENERAL =====
    (p_organization_id, 'General Announcement', 'general_announcement',
     'General purpose announcement template',
     '{{subject_line}}',
     '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #0f172a; padding: 30px; border-radius: 8px 8px 0 0;">
    <h1 style="color: #fff; margin: 0; font-size: 24px;">{{heading}}</h1>
  </div>
  <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">Hi {{member_name}},</p>
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">{{message_body}}</p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
    <p style="color: #6b7280; font-size: 14px;">— The {{organization_name}} Team</p>
  </div>
</div>',
     'Hi {{member_name}}, {{message_body}} — The {{organization_name}} Team',
     'general', true, '["member_name", "organization_name", "subject_line", "heading", "message_body"]'::jsonb),

    (p_organization_id, 'Account Update Confirmation', 'account_update',
     'Sent when a member updates their account information',
     'Your Account Has Been Updated',
     '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #0f172a; padding: 30px; border-radius: 8px 8px 0 0;">
    <h1 style="color: #fff; margin: 0; font-size: 24px;">Account Updated</h1>
  </div>
  <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">Hi {{member_name}},</p>
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">This is to confirm that your account information has been updated successfully.</p>
    <div style="background: #f3f4f6; border-radius: 6px; padding: 15px; margin: 15px 0;">
      <p style="color: #374151; margin: 0; font-size: 14px;"><strong>Updated:</strong> {{updated_fields}}</p>
      <p style="color: #6b7280; margin: 5px 0 0; font-size: 14px;">Date: {{update_date}}</p>
    </div>
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">If you did not make this change, please contact our support team immediately.</p>
  </div>
</div>',
     'Hi {{member_name}}, your account information has been updated: {{updated_fields}} on {{update_date}}. If you didn''t make this change, contact support.',
     'general', true, '["member_name", "updated_fields", "update_date"]'::jsonb)

  ON CONFLICT (organization_id, slug) DO NOTHING;
END;
$$;

-- Now seed templates for ALL existing organizations
DO $$
DECLARE
  org_record RECORD;
BEGIN
  FOR org_record IN SELECT id FROM organizations LOOP
    PERFORM seed_default_email_templates(org_record.id);
  END LOOP;
END;
$$;
