/**
 * CRM Communications Library
 * Email/SMS orchestration with SendGrid and Twilio
 */

// Types
export * from './types';

// Merge Fields
export {
  renderTemplate,
  extractMergeFields,
  validateMergeFields,
  buildSystemContext,
  buildMergeContext,
  checkSmsLength,
  truncateSms,
  generatePreview,
} from './mergeFields';

// Providers
export {
  sendMessage,
  getProviderStatus,
  sendEmail,
  sendSms,
  isValidEmail,
  isValidPhoneNumber,
  normalizePhoneNumber,
  mapSendGridEventToStatus,
  mapTwilioStatusToMessageStatus,
} from './providers';

// Dispatcher
export {
  dispatchMessage,
  sendMessageNow,
  processMessageQueue,
} from './dispatcher';
