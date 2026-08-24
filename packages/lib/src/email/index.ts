export {
  ResendEmailService,
  createResendService,
  EMAIL_TEMPLATES,
  type SendEmailOptions,
  type SendEmailResult,
  type EmailTemplate,
  type TemplateVariable,
  type SendTemplateOptions,
} from './resend-service';

export {
  EmailService,
  createEmailService,
  type SendEmailInput,
  type EmailStats,
} from './email-service';

export {
  sendEnrollmentConfirmationEmail,
  sendAdvisorNotificationEmail,
  type TransactionalEmailResult,
} from './transactional';

export {
  PIFH_EMAIL_DOMAIN,
  PIFH_INBOUND_DOMAIN,
  PIFH_EMAIL_ADDRESSES,
  PIFH_DEFAULT_FROM,
  PIFH_DEFAULT_FROM_NAME,
  PIFH_DEFAULT_REPLY_TO,
  PIFH_MONITORED_ADDRESSES,
  pifhEmail,
  pifhInboundEmail,
  inboundReplyTo,
  type PifhEmailRole,
  type PifhEmailAddress,
} from './pifh-email-addresses';
