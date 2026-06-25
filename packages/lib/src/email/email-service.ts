import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types';
import { ResendEmailService, SendEmailResult, EmailTemplate } from './resend-service';

// Types
export interface SendEmailInput {
  to: string;
  toName?: string;
  recipientType?: 'member' | 'advisor' | 'lead' | 'other';
  recipientId?: string;
  templateSlug?: string;
  templateId?: string;
  subject?: string;
  html?: string;
  text?: string;
  variables?: Record<string, string>;
  fromEmail?: string;
  fromName?: string;
  replyTo?: string;
  triggeredBy?: 'manual' | 'system' | 'automation' | 'api';
  triggeredByProfileId?: string;
  context?: Record<string, unknown>;
}

export interface EmailStats {
  totalSent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  failed: number;
}

/**
 * Email Service
 * High-level email service that integrates with Supabase and Resend
 */
export class EmailService {
  private supabase: SupabaseClient<Database>;
  private resend: ResendEmailService;
  private organizationId: string;

  constructor(
    supabase: SupabaseClient<Database>,
    organizationId: string,
    resendApiKey?: string
  ) {
    this.supabase = supabase;
    this.organizationId = organizationId;
    this.resend = new ResendEmailService(resendApiKey);
  }

  /**
   * Untyped Supabase client for tables not in generated Database types
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get db(): SupabaseClient<any> {
    return this.supabase;
  }

  /**
   * Send an email and track it in the database
   */
  async sendEmail(input: SendEmailInput): Promise<SendEmailResult & { sentEmailId?: string }> {
    let subject = input.subject || '';
    let html = input.html || '';
    let text = input.text;
    let templateId: string | null = null;

    // Merge the sending org's brand variables UNDER any caller-supplied
    // variables so BOTH the template path and the direct-HTML path below can
    // reference {{brand_logo_url}} / {{brand_company_name}} / {{brand_primary_color}}.
    // Caller-supplied keys always win (spread after). No-op when branding is empty.
    const brandVars = await this.getBrandVars();
    const variables: Record<string, string> = { ...brandVars, ...(input.variables || {}) };
    input = { ...input, variables };

    // If using a template, fetch and process it
    if (input.templateSlug || input.templateId) {
      const template = await this.getTemplate(input.templateSlug, input.templateId);
      
      if (!template) {
        return {
          success: false,
          error: 'Template not found',
        };
      }

      templateId = template.id;
      
      // Apply template with variables
      const result = await this.resend.sendTemplate({
        template,
        to: input.to,
        variables: input.variables || {},
        from: input.fromEmail,
        fromName: input.fromName,
        replyTo: input.replyTo,
      });

      // Record the sent email
      const sentEmailId = await this.recordSentEmail({
        ...input,
        subject: this.replaceVariables(template.subject, input.variables || {}),
        html: this.replaceVariables(template.body_html, input.variables || {}),
        text: template.body_text ? this.replaceVariables(template.body_text, input.variables || {}) : undefined,
        templateId,
        resendId: result.id,
        status: result.success ? 'sent' : 'failed',
        error: result.error,
      });

      return {
        ...result,
        sentEmailId,
      };
    }

    // Direct email (no template)
    if (!subject || !html) {
      return {
        success: false,
        error: 'Subject and HTML body are required when not using a template',
      };
    }

    // Apply variables to subject and body
    if (input.variables) {
      subject = this.replaceVariables(subject, input.variables);
      html = this.replaceVariables(html, input.variables);
      if (text) {
        text = this.replaceVariables(text, input.variables);
      }
    }

    const result = await this.resend.send({
      to: input.to,
      from: input.fromEmail,
      fromName: input.fromName,
      replyTo: input.replyTo,
      subject,
      html,
      text,
    });

    // Record the sent email
    const sentEmailId = await this.recordSentEmail({
      ...input,
      subject,
      html,
      text,
      templateId: null,
      resendId: result.id,
      status: result.success ? 'sent' : 'failed',
      error: result.error,
    });

    return {
      ...result,
      sentEmailId,
    };
  }

  /**
   * Queue an email for later sending
   */
  async queueEmail(input: SendEmailInput, scheduledFor?: Date): Promise<{ queueId: string } | { error: string }> {
    try {
      let subject = input.subject || '';
      let html = input.html || '';
      let text = input.text;

      // If using a template, fetch it
      if (input.templateSlug || input.templateId) {
        const template = await this.getTemplate(input.templateSlug, input.templateId);
        
        if (!template) {
          return { error: 'Template not found' };
        }

        subject = template.subject;
        html = template.body_html;
        text = template.body_text || undefined;
      }

      const { data, error } = await this.db
        .from('notification_queue')
        .insert({
          organization_id: this.organizationId,
          recipient_type: input.recipientType || 'other',
          email_address: input.to,
          notification_type: 'email',
          channel: 'email',
          subject,
          body: html,
          body_html: html,
          template_id: input.templateId || null,
          template_data: input.variables || {},
          scheduled_for: scheduledFor?.toISOString() || new Date().toISOString(),
          metadata: {
            from_email: input.fromEmail || process.env.RESEND_FROM_EMAIL || (() => { throw new Error('RESEND_FROM_EMAIL environment variable is required'); })(),
            from_name: input.fromName,
            reply_to: input.replyTo,
            body_text: text,
            to_name: input.toName,
            recipient_id: input.recipientId,
            triggered_by: input.triggeredBy || 'system',
            triggered_by_profile_id: input.triggeredByProfileId,
          },
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error queuing email:', error);
        return { error: error.message };
      }

      return { queueId: data.id };
    } catch (error) {
      console.error('Queue email error:', error);
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get a template by slug or ID
   */
  async getTemplate(slug?: string, id?: string): Promise<EmailTemplate | null> {
    let query = this.db
      .from('email_templates')
      .select('*')
      .eq('organization_id', this.organizationId)
      .eq('is_active', true);

    if (id) {
      query = query.eq('id', id);
    } else if (slug) {
      query = query.eq('slug', slug);
    } else {
      return null;
    }

    const { data, error } = await query.single();

    if (error || !data) {
      return null;
    }

    return data;
  }

  /**
   * Get all templates. The `category` argument is kept for backwards
   * compatibility but maps to the live DB column `template_type` (the
   * generic `category` column was never created in PIFH).
   */
  async getTemplates(category?: string): Promise<EmailTemplate[]> {
    let query = this.db
      .from('email_templates')
      .select('*')
      .eq('organization_id', this.organizationId)
      .eq('is_active', true)
      .order('template_type')
      .order('name');

    if (category) {
      query = query.eq('template_type', category);
    }

    const { data } = await query;
    return data || [];
  }

  /**
   * Get sent emails with pagination
   */
  async getSentEmails(options: {
    page?: number;
    limit?: number;
    recipientEmail?: string;
    recipientId?: string;
    status?: string;
    templateId?: string;
  }): Promise<{ emails: Record<string, unknown>[]; total: number }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;

    let query = this.db
      .from('sent_emails')
      .select('*, email_templates(name, slug)', { count: 'exact' })
      .eq('organization_id', this.organizationId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (options.recipientEmail) {
      query = query.eq('recipient_email', options.recipientEmail);
    }
    if (options.recipientId) {
      query = query.eq('recipient_id', options.recipientId);
    }
    if (options.status) {
      query = query.eq('status', options.status);
    }
    if (options.templateId) {
      query = query.eq('template_id', options.templateId);
    }

    const { data, count } = await query;

    return {
      emails: data || [],
      total: count || 0,
    };
  }

  /**
   * Get email stats for the organization
   */
  async getEmailStats(days: number = 30): Promise<EmailStats> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data } = await this.db
      .from('sent_emails')
      .select('status')
      .eq('organization_id', this.organizationId)
      .gte('created_at', startDate.toISOString());

    const stats: EmailStats = {
      totalSent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      failed: 0,
    };

    if (data) {
      for (const email of data) {
        stats.totalSent++;
        switch (email.status) {
          case 'delivered':
            stats.delivered++;
            break;
          case 'opened':
            stats.opened++;
            stats.delivered++; // Opened implies delivered
            break;
          case 'clicked':
            stats.clicked++;
            stats.opened++; // Clicked implies opened
            stats.delivered++;
            break;
          case 'bounced':
            stats.bounced++;
            break;
          case 'failed':
            stats.failed++;
            break;
        }
      }
    }

    return stats;
  }

  /**
   * Record a sent email in the database
   */
  private async recordSentEmail(data: {
    to: string;
    toName?: string;
    recipientType?: string;
    recipientId?: string;
    subject: string;
    html: string;
    text?: string;
    fromEmail?: string;
    fromName?: string;
    replyTo?: string;
    templateId?: string | null;
    resendId?: string;
    status: 'sent' | 'failed';
    error?: string;
    triggeredBy?: string;
    triggeredByProfileId?: string;
    context?: Record<string, unknown>;
  }): Promise<string | undefined> {
    try {
      const { data: result, error } = await this.db
        .from('sent_emails')
        .insert({
          organization_id: this.organizationId,
          email_type: data.recipientType || 'system',
          recipient_email: data.to,
          recipient_name: data.toName,
          template_id: data.templateId,
          subject: data.subject,
          body_html: data.html,
          body_text: data.text,
          from_email: data.fromEmail || process.env.RESEND_FROM_EMAIL || (() => { throw new Error('RESEND_FROM_EMAIL environment variable is required'); })(),
          from_name: data.fromName,
          reply_to: data.replyTo,
          provider: 'resend',
          provider_message_id: data.resendId,
          status: data.status,
          error_message: data.error,
          sent_at: data.status === 'sent' ? new Date().toISOString() : null,
          metadata: {
            triggered_by: data.triggeredBy || 'manual',
            triggered_by_profile_id: data.triggeredByProfileId,
            recipient_id: data.recipientId,
            context: data.context || {},
          },
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error recording sent email:', error);
        return undefined;
      }

      return result?.id;
    } catch (error) {
      console.error('Record sent email error:', error);
      return undefined;
    }
  }

  /**
   * HTML-escape a string to prevent XSS in email templates
   */
  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Resolve brand variables for the sending org from the single canonical
   * brand store, `organizations.branding` (jsonb). Read once via the same
   * client the service already uses (admin/SSR per the construction site).
   *
   * Mirrors the tolerant key resolution used by @crm-eco/ui's branding.ts
   * (nested `branding.colors.primary`, flat `branding.primary_color`, or
   * `branding.primary`) without importing the React UI package into @crm-eco/lib.
   *
   * Returns brand_* vars only when present, so an empty branding ('{}') yields
   * {} and email rendering is unchanged (PIFH stays default).
   */
  private async getBrandVars(): Promise<Record<string, string>> {
    try {
      const { data, error } = await this.db
        .from('organizations')
        .select('branding')
        .eq('id', this.organizationId)
        .single();

      if (error || !data) {
        return {};
      }

      const branding =
        data.branding !== null &&
        typeof data.branding === 'object' &&
        !Array.isArray(data.branding)
          ? (data.branding as Record<string, unknown>)
          : null;
      if (!branding) {
        return {};
      }

      const colors =
        branding.colors !== null &&
        typeof branding.colors === 'object' &&
        !Array.isArray(branding.colors)
          ? (branding.colors as Record<string, unknown>)
          : null;

      // Resolve a string value tolerant of nested / flat shapes.
      const pick = (...candidates: unknown[]): string | null => {
        for (const candidate of candidates) {
          if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
        }
        return null;
      };

      const vars: Record<string, string> = {};

      const logoUrl = pick(branding.logo_url, branding.logoUrl, branding.logo);
      if (logoUrl) vars.brand_logo_url = logoUrl;

      const companyName = pick(
        branding.company_name,
        branding.companyName,
        branding.name
      );
      if (companyName) vars.brand_company_name = companyName;

      const primaryColor = pick(colors?.primary, branding.primary_color, branding.primary);
      if (primaryColor) vars.brand_primary_color = primaryColor;

      return vars;
    } catch (err) {
      console.error('Error resolving brand variables:', err);
      return {};
    }
  }

  /**
   * Replace template variables in text.
   * Values are HTML-escaped to prevent injection in email HTML.
   */
  private replaceVariables(text: string, variables: Record<string, string>): string {
    let result = text;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(regex, this.escapeHtml(value || ''));
    }

    return result;
  }

  /**
   * Check if a member has opted out of a notification type
   */
  async canSendNotification(
    memberId: string,
    notificationType: string,
    channel: 'email' | 'sms' | 'push' = 'email'
  ): Promise<boolean> {
    const { data } = await this.db
      .from('notification_preferences')
      .select('*')
      .eq('member_id', memberId)
      .eq('notification_type', notificationType)
      .single();

    // If no preference exists, default to enabled
    if (!data) {
      return true;
    }

    switch (channel) {
      case 'email':
        return data.email_enabled;
      case 'sms':
        return data.sms_enabled;
      case 'push':
        return data.push_enabled;
      default:
        return true;
    }
  }
}

/**
 * Create an EmailService instance
 */
export function createEmailService(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  resendApiKey?: string
): EmailService {
  return new EmailService(supabase, organizationId, resendApiKey);
}
