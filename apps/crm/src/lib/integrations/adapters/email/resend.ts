/**
 * Resend Email Adapter
 * Handles email sending via Resend API
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

export class ResendAdapter implements EmailAdapter {
  readonly providerId = 'resend';
  readonly providerName = 'Resend';
  readonly authType = 'api_key' as const;

  private apiKey: string | null = null;
  private baseUrl = 'https://api.resend.com';

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
    } else if (!config.api_key.startsWith('re_')) {
      errors.push('API key should start with re_');
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
        message: 'Resend API key not configured',
      };
    }

    const startTime = Date.now();

    try {
      // Get API keys to verify credentials
      const response = await fetch(`${this.baseUrl}/api-keys`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return {
          success: false,
          message: error.message || `API error: ${response.status}`,
          durationMs: Date.now() - startTime,
        };
      }

      const data = await response.json();

      return {
        success: true,
        message: 'Connected to Resend successfully',
        durationMs: Date.now() - startTime,
        accountInfo: {
          name: `${data.data?.length || 0} API keys configured`,
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
      return { success: false, error: 'Resend API key not configured' };
    }

    try {
      const toAddresses = Array.isArray(params.to) ? params.to : [params.to];

      const payload: Record<string, unknown> = {
        from: params.fromName
          ? `${params.fromName} <${params.from || process.env.RESEND_FROM_EMAIL || 'noreply@example.com'}>`
          : params.from || process.env.RESEND_FROM_EMAIL || 'noreply@example.com',
        to: toAddresses,
        subject: params.subject,
      };

      // Content
      if (params.html) {
        payload.html = params.html;
      }
      if (params.text) {
        payload.text = params.text;
      }

      // Reply-to
      if (params.replyTo) {
        payload.reply_to = params.replyTo;
      }

      // Attachments
      if (params.attachments && params.attachments.length > 0) {
        payload.attachments = params.attachments.map((att) => ({
          content: att.content,
          filename: att.filename,
          content_type: att.contentType,
        }));
      }

      // Custom headers
      if (params.headers) {
        payload.headers = params.headers;
      }

      // Tags
      if (params.tags && params.tags.length > 0) {
        payload.tags = params.tags.map((tag) => ({ name: tag, value: 'true' }));
      }

      const response = await fetch(`${this.baseUrl}/emails`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || `Failed to send email: ${response.status}`,
        };
      }

      return {
        success: true,
        messageId: data.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email',
      };
    }
  }

  async getTemplates(): Promise<EmailTemplate[]> {
    // Resend doesn't have a built-in template system like SendGrid
    // Templates are typically managed through React Email or similar
    return [];
  }
}

// Register the adapter
registerAdapter('resend', 'email', () => new ResendAdapter());

export default ResendAdapter;
