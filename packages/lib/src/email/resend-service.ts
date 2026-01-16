import { Resend } from 'resend';

// Types
export interface SendEmailOptions {
  to: string | string[];
  from?: string;
  fromName?: string;
  replyTo?: string;
  subject: string;
  html: string;
  text?: string;
  tags?: { name: string; value: string }[];
  headers?: Record<string, string>;
  attachments?: {
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }[];
}

export interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  slug: string;
  subject: string;
  body_html: string;
  body_text?: string;
  from_name?: string;
  from_email?: string;
  reply_to?: string;
  variables: TemplateVariable[];
}

export interface TemplateVariable {
  name: string;
  description?: string;
  required?: boolean;
  defaultValue?: string;
}

export interface SendTemplateOptions {
  template: EmailTemplate;
  to: string | string[];
  variables: Record<string, string>;
  from?: string;
  fromName?: string;
  replyTo?: string;
}

/**
 * Resend Email Service
 * Handles sending emails via the Resend API
 */
export class ResendEmailService {
  private resend: Resend;
  private defaultFrom: string;
  private defaultFromName: string;

  constructor(apiKey?: string, defaultFrom?: string, defaultFromName?: string) {
    const key = apiKey || process.env.RESEND_API_KEY;
    if (!key) {
      throw new Error('Resend API key is required');
    }

    this.resend = new Resend(key);
    this.defaultFrom = defaultFrom || process.env.RESEND_FROM_EMAIL || 'noreply@example.com';
    this.defaultFromName = defaultFromName || process.env.RESEND_FROM_NAME || 'HealthShare';
  }

  /**
   * Send an email
   */
  async send(options: SendEmailOptions): Promise<SendEmailResult> {
    try {
      const fromEmail = options.from || this.defaultFrom;
      const fromName = options.fromName || this.defaultFromName;
      const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

      const { data, error } = await this.resend.emails.send({
        from,
        to: Array.isArray(options.to) ? options.to : [options.to],
        replyTo: options.replyTo,
        subject: options.subject,
        html: options.html,
        text: options.text,
        tags: options.tags,
        headers: options.headers,
        attachments: options.attachments,
      });

      if (error) {
        console.error('Resend API error:', error);
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
        id: data?.id,
      };
    } catch (error) {
      console.error('Email send error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send an email using a template
   */
  async sendTemplate(options: SendTemplateOptions): Promise<SendEmailResult> {
    const { template, to, variables } = options;

    // Replace variables in subject and body
    const subject = this.replaceVariables(template.subject, variables);
    const html = this.replaceVariables(template.body_html, variables);
    const text = template.body_text 
      ? this.replaceVariables(template.body_text, variables)
      : undefined;

    return this.send({
      to,
      from: options.from || template.from_email,
      fromName: options.fromName || template.from_name,
      replyTo: options.replyTo || template.reply_to,
      subject,
      html,
      text,
      tags: [
        { name: 'template_id', value: template.id },
        { name: 'template_slug', value: template.slug },
      ],
    });
  }

  /**
   * Replace template variables in text
   * Supports {{variableName}} syntax
   */
  private replaceVariables(text: string, variables: Record<string, string>): string {
    let result = text;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(regex, value || '');
    }

    // Remove any remaining unreplaced variables
    result = result.replace(/\{\{\s*\w+\s*\}\}/g, '');

    return result;
  }

  /**
   * Validate that all required variables are provided
   */
  validateVariables(
    template: EmailTemplate,
    variables: Record<string, string>
  ): { valid: boolean; missing: string[] } {
    const missing: string[] = [];

    for (const variable of template.variables) {
      if (variable.required && !variables[variable.name]) {
        missing.push(variable.name);
      }
    }

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  /**
   * Get email status from Resend
   */
  async getEmailStatus(emailId: string): Promise<{
    status: string;
    lastEvent?: string;
    deliveredAt?: string;
    openedAt?: string;
  } | null> {
    try {
      const { data, error } = await this.resend.emails.get(emailId);

      if (error || !data) {
        return null;
      }

      return {
        status: data.last_event || 'unknown',
        lastEvent: data.last_event,
        // Note: Resend returns these in the events array
      };
    } catch (error) {
      console.error('Error getting email status:', error);
      return null;
    }
  }
}

/**
 * Create a ResendEmailService instance
 */
export function createResendService(
  apiKey?: string,
  defaultFrom?: string,
  defaultFromName?: string
): ResendEmailService {
  return new ResendEmailService(apiKey, defaultFrom, defaultFromName);
}

// Pre-built email templates
export const EMAIL_TEMPLATES = {
  WELCOME: {
    slug: 'welcome',
    name: 'Welcome Email',
    subject: 'Welcome to {{organizationName}}!',
    variables: [
      { name: 'firstName', required: true },
      { name: 'organizationName', required: true },
      { name: 'loginUrl', required: false },
    ],
  },
  ENROLLMENT_CONFIRMATION: {
    slug: 'enrollment-confirmation',
    name: 'Enrollment Confirmation',
    subject: 'Your enrollment has been received',
    variables: [
      { name: 'firstName', required: true },
      { name: 'planName', required: true },
      { name: 'enrollmentId', required: true },
    ],
  },
  ENROLLMENT_APPROVED: {
    slug: 'enrollment-approved',
    name: 'Enrollment Approved',
    subject: 'Great news! Your enrollment has been approved',
    variables: [
      { name: 'firstName', required: true },
      { name: 'planName', required: true },
      { name: 'effectiveDate', required: true },
      { name: 'memberId', required: false },
    ],
  },
  PAYMENT_RECEIPT: {
    slug: 'payment-receipt',
    name: 'Payment Receipt',
    subject: 'Payment Received - Receipt #{{receiptNumber}}',
    variables: [
      { name: 'firstName', required: true },
      { name: 'amount', required: true },
      { name: 'receiptNumber', required: true },
      { name: 'paymentDate', required: true },
    ],
  },
  PAYMENT_FAILED: {
    slug: 'payment-failed',
    name: 'Payment Failed',
    subject: 'Action Required: Payment Failed',
    variables: [
      { name: 'firstName', required: true },
      { name: 'amount', required: true },
      { name: 'reason', required: false },
      { name: 'updatePaymentUrl', required: true },
    ],
  },
  PAYMENT_REMINDER: {
    slug: 'payment-reminder',
    name: 'Payment Reminder',
    subject: 'Upcoming Payment Reminder',
    variables: [
      { name: 'firstName', required: true },
      { name: 'amount', required: true },
      { name: 'dueDate', required: true },
    ],
  },
  PASSWORD_RESET: {
    slug: 'password-reset',
    name: 'Password Reset',
    subject: 'Reset Your Password',
    variables: [
      { name: 'firstName', required: false },
      { name: 'resetUrl', required: true },
      { name: 'expiresIn', required: false },
    ],
  },
};
