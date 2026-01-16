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
   * Send an email and track it in the database
   */
  async sendEmail(input: SendEmailInput): Promise<SendEmailResult & { sentEmailId?: string }> {
    let subject = input.subject || '';
    let html = input.html || '';
    let text = input.text;
    let templateId: string | null = null;

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

      const { data, error } = await (this.supabase as any)
        .from('email_queue')
        .insert({
          organization_id: this.organizationId,
          to_email: input.to,
          to_name: input.toName,
          from_email: input.fromEmail || process.env.RESEND_FROM_EMAIL || 'noreply@example.com',
          from_name: input.fromName,
          reply_to: input.replyTo,
          subject,
          body_html: html,
          body_text: text,
          template_id: input.templateId || null,
          template_data: input.variables || {},
          recipient_type: input.recipientType,
          recipient_id: input.recipientId,
          triggered_by: input.triggeredBy || 'system',
          triggered_by_profile_id: input.triggeredByProfileId,
          scheduled_for: scheduledFor?.toISOString() || new Date().toISOString(),
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
    let query = (this.supabase as any)
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
   * Get all templates
   */
  async getTemplates(category?: string): Promise<EmailTemplate[]> {
    let query = (this.supabase as any)
      .from('email_templates')
      .select('*')
      .eq('organization_id', this.organizationId)
      .eq('is_active', true)
      .order('category')
      .order('name');

    if (category) {
      query = query.eq('category', category);
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
  }): Promise<{ emails: any[]; total: number }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;

    let query = (this.supabase as any)
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

    const { data } = await (this.supabase as any)
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
      const { data: result, error } = await (this.supabase as any)
        .from('sent_emails')
        .insert({
          organization_id: this.organizationId,
          recipient_email: data.to,
          recipient_name: data.toName,
          recipient_type: data.recipientType,
          recipient_id: data.recipientId,
          template_id: data.templateId,
          subject: data.subject,
          body_html: data.html,
          body_text: data.text,
          from_email: data.fromEmail || process.env.RESEND_FROM_EMAIL || 'noreply@example.com',
          from_name: data.fromName,
          reply_to: data.replyTo,
          status: data.status,
          resend_id: data.resendId,
          sent_at: data.status === 'sent' ? new Date().toISOString() : null,
          failed_at: data.status === 'failed' ? new Date().toISOString() : null,
          error_message: data.error,
          triggered_by: data.triggeredBy || 'manual',
          triggered_by_profile_id: data.triggeredByProfileId,
          context: data.context || {},
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
   * Replace template variables in text
   */
  private replaceVariables(text: string, variables: Record<string, string>): string {
    let result = text;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(regex, value || '');
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
    const { data } = await (this.supabase as any)
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
