/**
 * Webhooks Index
 * Export webhook utilities and auto-register handlers
 */

export * from './types';
export * from './router';

// Auto-register handlers by importing them
import './handlers/stripe';
