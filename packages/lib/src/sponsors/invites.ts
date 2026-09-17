import { isSponsorEmailEnabled } from './flags';

export interface SponsorInviteResult {
  sent: boolean;
  dryRun: boolean;
  error?: string;
}

export function sponsorAdminInviteHtml(input: {
  sponsorName: string;
  employerUrl: string;
}): string {
  return `<p>You were invited to administer ${escapeHtml(input.sponsorName)}.</p>
<p><a href="${escapeHtml(input.employerUrl)}">Open the employer portal</a></p>`;
}

export function employeeInviteHtml(input: {
  sponsorName: string;
  enrollUrl: string;
  firstName: string;
  locale?: 'en' | 'es';
}): string {
  if (input.locale === 'es') {
    return `<p>Hola ${escapeHtml(input.firstName)},</p>
<p>${escapeHtml(input.sponsorName)} lo(a) invita a inscribirse.</p>
<p><a href="${escapeHtml(input.enrollUrl)}">Comenzar inscripción</a></p>`;
  }
  return `<p>Hello ${escapeHtml(input.firstName)},</p>
<p>${escapeHtml(input.sponsorName)} invited you to enroll.</p>
<p><a href="${escapeHtml(input.enrollUrl)}">Start enrollment</a></p>`;
}

export function mismatchNotifyHtml(input: {
  sponsorName: string;
  personName: string;
  reason: string;
}): string {
  return `<p>An enrollment for ${escapeHtml(input.personName)} needs your approval at ${escapeHtml(input.sponsorName)}.</p>
<p>${escapeHtml(input.reason)}</p>`;
}

export async function sendSponsorInviteEmail(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<SponsorInviteResult> {
  if (!isSponsorEmailEnabled()) {
    return { sent: false, dryRun: true };
  }
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    return { sent: false, dryRun: true, error: 'Transactional email is not configured' };
  }
  try {
    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: `${process.env.RESEND_FROM_NAME || 'Pay It Forward Health'} <${from}>`,
      to: [input.to],
      subject: input.subject,
      html: input.html,
    });
    if (error) return { sent: false, dryRun: false, error: error.message };
    return { sent: true, dryRun: false };
  } catch (err) {
    return {
      sent: false,
      dryRun: false,
      error: err instanceof Error ? err.message : 'Invite send failed',
    };
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
