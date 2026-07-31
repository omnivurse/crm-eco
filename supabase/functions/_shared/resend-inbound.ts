/**
 * Body hydration for Resend inbound email.
 *
 * Resend's `email.received` webhook carries metadata ONLY — no body, no
 * headers, no attachment content. From their docs:
 *
 *   "Webhooks do not include the email body, headers, or attachments, only
 *    their metadata. You must call the Received emails API [...] This design
 *    choice supports large attachments in serverless environments that have
 *    limited request body sizes."
 *
 * So reading `data.text` off the webhook always yields undefined, and every
 * inbound message lands with an empty body. The body has to be fetched in a
 * second call against the received-emails endpoint.
 *
 * The guiding rule here is that mail must never be lost. If hydration fails
 * for any reason (bad key, rate limit, transient 5xx, timeout) we return null
 * and the caller files the message with metadata only — a subject-line-only
 * thread is recoverable, a dropped webhook is not.
 */

const RESEND_API_BASE = "https://api.resend.com";

/** Shape of the fields we consume from GET /emails/receiving/:id. */
export interface ResendReceivedEmail {
  text?: string | null;
  html?: string | null;
  headers?: Record<string, string> | Array<{ name: string; value: string }> | null;
  reply_to?: string[] | null;
  /** Original recipients from the `for` clause of Received headers. */
  received_for?: string[] | null;
  attachments?: Array<{
    id?: string;
    filename?: string;
    content_type?: string;
    size?: number;
    content_id?: string | null;
    content_disposition?: string | null;
  }> | null;
}

/** Minimal shape hydration merges into. Mirrors the intake EmailPayload. */
export interface HydratableEmail {
  subject: string;
  body_text: string;
  body_html?: string;
  reply_to?: string[];
  headers?: Record<string, string>;
  attachments?: Array<{
    filename: string;
    content_type: string;
    size: number;
    url?: string;
    content?: string;
  }>;
}

export function normaliseResendHeaders(
  headers?: Record<string, string> | Array<{ name: string; value: string }> | null,
): Record<string, string> {
  if (!headers) return {};
  const out: Record<string, string> = {};
  if (Array.isArray(headers)) {
    for (const h of headers) {
      if (h?.name) out[h.name.toLowerCase()] = h.value;
    }
    return out;
  }
  for (const [k, v] of Object.entries(headers)) out[k.toLowerCase()] = v;
  return out;
}

/**
 * Fold fetched content onto the webhook metadata.
 *
 * Pure and defensive on purpose: hydration is best-effort, so a partial or
 * malformed response must degrade to "keep what the webhook told us" rather
 * than blanking fields that were already correct. A fetched value only wins
 * when it is actually non-empty.
 */
export function mergeHydratedEmail<T extends HydratableEmail>(
  base: T,
  fetched: ResendReceivedEmail | null,
): T {
  if (!fetched) return base;

  const text = typeof fetched.text === "string" ? fetched.text : "";
  const html = typeof fetched.html === "string" ? fetched.html : "";
  const headers = normaliseResendHeaders(fetched.headers);

  const merged: T = { ...base };

  if (text.trim()) merged.body_text = text;
  if (html.trim()) merged.body_html = html;

  // Webhook headers win where present; hydrated headers fill the rest. The
  // webhook is the signed artifact, so it is the more trustworthy source.
  if (Object.keys(headers).length > 0) {
    merged.headers = { ...headers, ...(base.headers || {}) };
  }

  if (Array.isArray(fetched.reply_to) && fetched.reply_to.length > 0 && !base.reply_to?.length) {
    merged.reply_to = fetched.reply_to;
  }

  // Attachment metadata only — content is deliberately not downloaded here, so
  // a large attachment can never blow the function's memory or timeout budget.
  if (Array.isArray(fetched.attachments) && fetched.attachments.length > 0 && !base.attachments?.length) {
    merged.attachments = fetched.attachments.map((a) => ({
      filename: a.filename || "attachment",
      content_type: a.content_type || "application/octet-stream",
      size: typeof a.size === "number" ? a.size : 0,
    }));
  }

  return merged;
}

/**
 * Pick the org-owned address this mail was originally addressed to.
 *
 * When a forwarder (e.g. the apex MX) relays into the CRM's receiving
 * subdomain, the envelope `To` becomes the subdomain address while the true
 * original recipient survives only in `received_for`. Preferring it keeps a
 * forwarded thread filed under the mailbox the member actually wrote to.
 */
export function preferredRecipient(
  receivedFor: string[] | null | undefined,
  ownedDomains: string[],
): string | null {
  if (!Array.isArray(receivedFor) || receivedFor.length === 0) return null;
  const owned = new Set(ownedDomains.map((d) => d.trim().toLowerCase()).filter(Boolean));

  for (const raw of receivedFor) {
    const addr = (raw || "").trim().toLowerCase();
    const domain = addr.split("@")[1];
    if (domain && owned.has(domain)) return addr;
  }
  return null;
}

/**
 * Fetch full content for a received email.
 *
 * Returns null rather than throwing so the caller can always still file the
 * message. Retries once because the webhook can occasionally beat the
 * body's own availability, but stays strictly bounded — an inbound webhook
 * must answer fast or Resend will redeliver and we would duplicate work.
 */
export async function fetchReceivedEmail(
  emailId: string,
  apiKey: string,
  opts?: {
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
    attempts?: number;
    sleep?: (ms: number) => Promise<void>;
  },
): Promise<ResendReceivedEmail | null> {
  if (!emailId || !apiKey) return null;

  const doFetch = opts?.fetchImpl ?? fetch;
  const timeoutMs = opts?.timeoutMs ?? 5000;
  const attempts = Math.max(1, opts?.attempts ?? 2);
  const sleep = opts?.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await doFetch(
        `${RESEND_API_BASE}/emails/receiving/${encodeURIComponent(emailId)}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: controller.signal,
        },
      );

      if (res.ok) return (await res.json()) as ResendReceivedEmail;

      // 4xx other than 404 will not fix themselves; stop wasting the budget.
      if (res.status !== 404 && res.status < 500) {
        console.error(`Resend hydration refused (${res.status}) for ${emailId}`);
        return null;
      }
      console.warn(`Resend hydration attempt ${attempt}/${attempts} got ${res.status} for ${emailId}`);
    } catch (err) {
      console.warn(
        `Resend hydration attempt ${attempt}/${attempts} failed for ${emailId}:`,
        err instanceof Error ? err.message : err,
      );
    } finally {
      clearTimeout(timer);
    }

    if (attempt < attempts) await sleep(250 * attempt);
  }

  return null;
}
