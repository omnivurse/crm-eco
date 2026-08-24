/**
 * PIFH @payitforwardhealth.com email catalog.
 *
 * MX strategy (hybrid):
 * - Root domain: Google Workspace for staff mailboxes (wendy@, etc.)
 * - mail.payitforwardhealth.com: Resend inbound → email-intake → CRM/Admin inbox
 * - Root + mail subdomains: Resend outbound send for all registered From addresses
 */

export const PIFH_EMAIL_DOMAIN = 'payitforwardhealth.com';
export const PIFH_INBOUND_DOMAIN = 'mail.payitforwardhealth.com';

export type PifhEmailRole =
  | 'transactional'
  | 'monitored'
  | 'staff'
  | 'marketing';

export interface PifhEmailAddress {
  localPart: string;
  displayName: string;
  role: PifhEmailRole;
  /** Default org sender for this category */
  isDefault?: boolean;
  /** Reply-To when sending from noreply */
  replyTo?: string;
}

/** Full address helper */
export function pifhEmail(localPart: string): string {
  return `${localPart}@${PIFH_EMAIL_DOMAIN}`;
}

/** Resend receiving address for a local part (`support` → `support@mail…`). */
export function pifhInboundEmail(localPart: string): string {
  return `${localPart}@${PIFH_INBOUND_DOMAIN}`;
}

function normalizeAddress(value: string): string {
  const trimmed = value.trim().toLowerCase();
  const angle = trimmed.match(/<([^>]+)>/);
  return (angle ? angle[1] : trimmed).trim();
}

/**
 * Rewrite a From / Reply-To onto the Resend inbound subdomain so replies
 * reach `email-intake` instead of the apex MX (Liberation / Workspace).
 *
 * `noreply@` maps to `support@mail…` — transactional From must not collect replies.
 * Addresses already on the inbound domain, or on any other domain, are unchanged.
 */
export function inboundReplyTo(address: string): string {
  const email = normalizeAddress(address);
  const at = email.lastIndexOf('@');
  if (at <= 0) return email;

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (domain === PIFH_INBOUND_DOMAIN) return email;
  if (domain !== PIFH_EMAIL_DOMAIN) return email;

  const inboundLocal = local === 'noreply' ? 'support' : local;
  return pifhInboundEmail(inboundLocal);
}

export const PIFH_EMAIL_ADDRESSES: PifhEmailAddress[] = [
  { localPart: 'noreply', displayName: 'Pay It Forward Health', role: 'transactional', isDefault: true, replyTo: 'support@payitforwardhealth.com' },
  { localPart: 'support', displayName: 'Pay It Forward Health Support', role: 'monitored' },
  { localPart: 'hello', displayName: 'Pay It Forward Health', role: 'marketing' },
  { localPart: 'membership', displayName: 'Pay It Forward Health Membership', role: 'monitored' },
  { localPart: 'info', displayName: 'Pay It Forward Health', role: 'monitored' },
  { localPart: 'contact', displayName: 'Pay It Forward Health', role: 'monitored' },
  { localPart: 'billing', displayName: 'Pay It Forward Health Billing', role: 'monitored' },
  { localPart: 'admin', displayName: 'Pay It Forward Health Admin', role: 'monitored' },
  { localPart: 'privacy', displayName: 'Pay It Forward Health Privacy', role: 'monitored', replyTo: 'compliance@payitforwardhealth.com' },
  { localPart: 'compliance', displayName: 'Pay It Forward Health Compliance', role: 'monitored' },
  { localPart: 'legal', displayName: 'Pay It Forward Health Legal', role: 'monitored' },
  { localPart: 'enrollment', displayName: 'Pay It Forward Health Enrollment', role: 'transactional' },
  { localPart: 'notifications', displayName: 'Pay It Forward Health', role: 'transactional' },
  { localPart: 'advocacy', displayName: 'Pay It Forward Health Advocacy', role: 'monitored' },
  { localPart: 'security', displayName: 'Pay It Forward Health Security', role: 'monitored' },
  { localPart: 'wendy', displayName: 'Wendy Scipione', role: 'staff' },
];

export const PIFH_DEFAULT_FROM = pifhEmail('noreply');
export const PIFH_DEFAULT_FROM_NAME = 'Pay It Forward Health';
export const PIFH_DEFAULT_REPLY_TO = pifhEmail('support');

/** Monitored addresses that receive via Resend → CRM/Admin inbox */
export const PIFH_MONITORED_ADDRESSES = PIFH_EMAIL_ADDRESSES.filter(
  (a) => a.role === 'monitored' || a.role === 'marketing',
).map((a) => pifhEmail(a.localPart));
