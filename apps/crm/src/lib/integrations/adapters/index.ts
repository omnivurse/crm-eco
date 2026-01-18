/**
 * Integration Adapters Index
 * Export all adapters and auto-register them
 */

// Base interfaces
export * from './base';

// Registry
export * from './registry';

// Credentials
export * from './credentials';

// Auto-register adapters by importing them
import './payments/stripe';
import './email/sendgrid';
import './email/resend';
