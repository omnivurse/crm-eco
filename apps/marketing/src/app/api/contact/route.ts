import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Resend } from 'resend';
import { ContactRequestEmail } from '@/emails/ContactRequestEmail';

/**
 * Contact form endpoint
 * --------------------------------------------------------------
 * Accepts both `application/x-www-form-urlencoded` (HTML form) and
 * `application/json` payloads. Validates with zod, drops obvious
 * bot traffic (honeypot + soft rate-limit), then dispatches a
 * React Email through Resend.
 *
 * Security posture:
 *  - PII is never logged; only sanitized counters / hashes are.
 *  - Honeypot field (`company_url`) silently absorbs bots.
 *  - In-memory IP rate limiter (best-effort; Vercel edge is
 *    multi-region so this is opportunistic, not authoritative).
 *  - `idempotencyKey` derived from a hash of submitter+intent so
 *    accidental double-submits within 24h dedupe at Resend.
 *
 * Required env (read at request time so build never crashes if
 * the env is not provisioned in preview):
 *   - RESEND_API_KEY               — Resend secret
 *   - SALES_FROM_EMAIL             — defaults to "Double Helix <noreply@doublehelix.com>"
 *   - SALES_INBOX_EMAIL            — defaults to "sales@doublehelix.com"
 */

const ContactSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.string().trim().toLowerCase().email('Valid email required').max(254),
  company: z.string().trim().min(1, 'Company is required').max(160),
  role: z.string().trim().max(120).optional().or(z.literal('').transform(() => undefined)),
  member_count: z.string().trim().max(40).optional().or(z.literal('').transform(() => undefined)),
  message: z.string().trim().min(20, 'Message is too short').max(4000),
  intent: z
    .enum(['demo', 'admin-demo', 'crm-demo', 'pricing', 'partnership'])
    .optional()
    .default('demo'),
  // Honeypot — must be empty.
  company_url: z.string().max(0).optional().or(z.literal('').transform(() => undefined)),
});

type ContactPayload = z.infer<typeof ContactSchema>;

/** Best-effort, in-memory rate limit: 3 requests / 60s / IP. */
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 3;
const rateBuckets = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (rateBuckets.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  rateBuckets.set(ip, recent);
  return recent.length > RATE_LIMIT;
}

function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

/** Stable, low-entropy fingerprint suitable for an idempotency key. */
async function fingerprint(parts: string[]): Promise<string> {
  const buf = new TextEncoder().encode(parts.join('|'));
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function redirectTo(req: Request, status: 'ok' | 'error' | 'rate_limited'): NextResponse {
  return NextResponse.redirect(new URL(`/contact?status=${status}`, req.url), {
    status: 303,
  });
}

function jsonResponse(
  ok: boolean,
  body: Record<string, unknown>,
  init?: ResponseInit,
): NextResponse {
  return NextResponse.json({ ok, ...body }, init);
}

async function parsePayload(req: Request): Promise<unknown> {
  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return req.json();
  }
  const fd = await req.formData();
  return Object.fromEntries(fd.entries());
}

export async function POST(req: Request) {
  const wantsJson = (req.headers.get('accept') ?? '').includes('application/json');

  let raw: unknown;
  try {
    raw = await parsePayload(req);
  } catch {
    return wantsJson
      ? jsonResponse(false, { error: 'Invalid payload' }, { status: 400 })
      : redirectTo(req, 'error');
  }

  const parsed = ContactSchema.safeParse(raw);
  if (!parsed.success) {
    if (wantsJson) {
      return jsonResponse(
        false,
        { error: 'Validation failed', issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    return redirectTo(req, 'error');
  }

  const data: ContactPayload = parsed.data;

  // Honeypot tripped — silently swallow.
  if (data.company_url && data.company_url.length > 0) {
    return wantsJson ? jsonResponse(true, { skipped: true }) : redirectTo(req, 'ok');
  }

  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    return wantsJson
      ? jsonResponse(false, { error: 'Rate limited' }, { status: 429 })
      : redirectTo(req, 'rate_limited');
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // No secret in this environment — accept the submission so that
    // local/preview never breaks, but flag it server-side. Never log PII.
    console.warn('[contact] RESEND_API_KEY is not configured — skipping send');
    return wantsJson ? jsonResponse(true, { delivered: false }) : redirectTo(req, 'ok');
  }

  const fromAddress =
    process.env.SALES_FROM_EMAIL ?? 'Double Helix <noreply@doublehelix.com>';
  const toAddress = process.env.SALES_INBOX_EMAIL ?? 'sales@doublehelix.com';

  const submittedAt = new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const idempotencyKey = `contact-request/${await fingerprint([
    data.email,
    data.intent,
    data.message.slice(0, 64),
  ])}`;

  const resend = new Resend(apiKey);

  const subjectLabel =
    data.intent === 'admin-demo'
      ? 'Admin demo'
      : data.intent === 'crm-demo'
        ? 'CRM demo'
        : data.intent === 'pricing'
          ? 'Pricing'
          : data.intent === 'partnership'
            ? 'Partnership'
            : 'Platform demo';

  const { error } = await resend.emails.send(
    {
      from: fromAddress,
      to: [toAddress],
      replyTo: data.email,
      subject: `[Double Helix] ${subjectLabel} — ${data.name} @ ${data.company}`,
      react: ContactRequestEmail({
        name: data.name,
        email: data.email,
        company: data.company,
        role: data.role,
        memberCount: data.member_count,
        intent: data.intent,
        message: data.message,
        submittedAt: `${submittedAt} EDT`,
        source: 'doublehelix.com/contact',
      }),
      tags: [
        { name: 'app', value: 'marketing' },
        { name: 'kind', value: 'contact-request' },
        { name: 'intent', value: data.intent },
      ],
    },
    { idempotencyKey },
  );

  if (error) {
    // Resend SDK returns errors via the result object, not exceptions.
    console.error('[contact] resend.emails.send failed', {
      name: error.name,
      message: error.message,
    });
    return wantsJson
      ? jsonResponse(false, { error: 'Delivery failed' }, { status: 502 })
      : redirectTo(req, 'error');
  }

  return wantsJson
    ? jsonResponse(true, { delivered: true })
    : redirectTo(req, 'ok');
}
