// ============================================================================
// Server-side email HTML sanitization.
//
// sanitizeOutboundEmailHtml() runs inside sendEmail() before any provider
// payload, outbox row, sent_emails row, or inbox_messages copy is built, so
// every producer (composer, reply dock, record sends, future automations) is
// covered and no client can skip it.
//
// sanitizeInboundEmailHtml() is the permissive-but-inert profile for stored
// inbound mail; the reading pane applies an equivalent DOMPurify pass at
// render time (see inbox-reading.ts) — this export exists for server-side
// callers (e.g. future intake-time sanitization) and for parity tests.
// ============================================================================

import sanitizeHtml from 'sanitize-html';
import {
  INBOUND_SANITIZE_OPTIONS,
  OUTBOUND_SANITIZE_OPTIONS,
} from './email-html-policy';

/** Strict profile: reduce arbitrary HTML to the composer's compiled tag set. */
export function sanitizeOutboundEmailHtml(html: string): string {
  return sanitizeHtml(html, OUTBOUND_SANITIZE_OPTIONS);
}

/** Permissive-but-inert profile: keep layout fidelity, remove script vectors. */
export function sanitizeInboundEmailHtml(html: string): string {
  return sanitizeHtml(html, INBOUND_SANITIZE_OPTIONS);
}
