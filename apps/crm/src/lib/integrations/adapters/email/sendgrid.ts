/**
 * SendGrid Email Adapter
 * Handles email sending via SendGrid API
 */

import { registerAdapter } from '../registry';
import type {
  EmailAdapter,
  AdapterConfig,
  ValidationResult,
  TestResult,
  ProviderCapability,
  SendEmailParams,
  SendEmailResult,
  EmailTemplate,
} from '../base';

export class SendGridAdapter implements EmailAdapter {
  readonly providerId = 'sendgrid';
  readonly providerName = 'SendGrid';
  readonly authType = 'api_key' as const;

  private apiKey: string | null = null;
  private baseUrl = 'https://api.sendgrid.com/v3';

  initialize(config: AdapterConfig): void {
    this.apiKey = config.apiKey || null;
  }

  getCapabilities(): ProviderCapability[] {
    return ['send_email', 'receive_webhook'];
  }

  validateConfig(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    if (!config.api_key || typeof config.api_key !== 'string') {
      errors.push('API key is required');
    } else if (!config.api_key.startsWith('SG.')) {
      errors.push('API key should start with SG.');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  async testConnection(): Promise<TestResult> {
    if (!this.apiKey) {
      return {
        success: false,
        message: 'SendGrid API key not configured',
      };
    }

    const startTime = Date.now();

    try {
      // Check API key scopes/validity
      const response = await fetch(`${this.baseUrl}/scopes`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return {
          success: false,
          message: error.errors?.[0]?.message || `API error: ${response.status}`,
          durationMs: Date.now() - startTime,
        };
      }

      const data = await response.json();

      return {
        success: true,
        message: 'Connected to SendGrid successfully',
        durationMs: Date.now() - startTime,
        accountInfo: {
          name: `${data.scopes?.length || 0} API scopes available`,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed',
        durationMs: Date.now() - startTime,
      };
    }
  }

  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    if (!this.apiKey) {
      return { success: false, error: 'SendGrid API key not configured' };
    }

    try {
      const toAddresses = Array.isArray(params.to) ? params.to : [params.to];

      const payload: Record<string, unknown> = {
        personalizations: [
          {
            to: toAddresses.map((email) => ({ email })),
          },
        ],
        from: {
          email: params.from || process.env.SENDGRID_FROM_EMAIL || 'noreply@example.com',
          name: params.fromName,
        },
        subject: params.subject,
      };

      // Content
      if (params.templateId) {
        payload.template_id = params.templateId;
        if (params.templateData) {
          (payload.personalizations as Record<string, unknown>[])[0].dynamic_template_data = params.templateData;
        }
      } else {
        payload.content = [];
        if (params.text) {
          (payload.content as Record<string, unknown>[]).push({ type: 'text/plain', value: params.text });
        }
        if (params.html) {
          (payload.content as Record<string, unknown>[]).push({ type: 'text/html', value: params.html });
        }
      }

      // Reply-to
      if (params.replyTo) {
        payload.reply_to = { email: params.replyTo };
      }

      // Attachments
      if (params.attachments && params.attachments.length > 0) {
        payload.attachments = params.attachments.map((att) => ({
          content: att.content,
          filename: att.filename,
          type: att.contentType,
          disposition: 'attachment',
        }));
      }

      // Custom headers
      if (params.headers) {
        payload.headers = params.headers;
      }

      // Categories/tags
      if (params.tags && params.tags.length > 0) {
        payload.categories = params.tags;
      }

      const response = await fetch(`${this.baseUrl}/mail/send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return {
          success: false,
          error: error.errors?.[0]?.message || `Failed to send email: ${response.status}`,
        };
      }

      // SendGrid returns message ID in header
      const messageId = response.headers.get('x-message-id') || undefined;

      return {
        success: true,
        messageId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email',
      };
    }
  }

  async getTemplates(): Promise<EmailTemplate[]> {
    if (!this.apiKey) {
      return [];
    }

    try {
      const response = await fetch(`${this.baseUrl}/templates?generations=dynamic`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();

      return (data.templates || []).map((template: Record<string, unknown>) => ({
        id: template.id as string,
        name: template.name as string,
        subject: (template.versions as Array<Record<string, unknown>>)?.[0]?.subject as string | undefined,
      }));
    } catch {
      return [];
    }
  }

  async validateEmail(email: string): Promise<{ valid: boolean; reason?: string }> {
    if (!this.apiKey) {
      return { valid: false, reason: 'API key not configured' };
    }

    try {
      const response = await fetch(`${this.baseUrl}/validations/email`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        return { valid: false, reason: 'Validation failed' };
      }

      const data = await response.json();
      const result = data.result;

      return {
        valid: result.verdict === 'Valid',
        reason: result.verdict !== 'Valid' ? result.verdict : undefined,
      };
    } catch {
      return { valid: false, reason: 'Validation request failed' };
    }
  }
}

// Register the adapter
registerAdapter('sendgrid', 'email', () => new SendGridAdapter());

export default SendGridAdapter;
