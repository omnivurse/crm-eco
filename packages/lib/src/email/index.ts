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
