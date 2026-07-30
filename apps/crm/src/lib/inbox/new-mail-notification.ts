/**
 * When to announce new mail, and what the announcement says.
 *
 * Split out from the React listener because the interesting part is the
 * judgement, not the subscription: notifying about the wrong message is worse
 * than not notifying at all. An agent who gets a popup for their own outbound
 * reply, or for the thread already open on screen, learns to ignore popups —
 * and then misses the one that mattered.
 */

export const MAX_SNIPPET_LENGTH = 140;

export interface IncomingMessage {
  id: string;
  conversation_id: string;
  direction: string;
  from_address?: string | null;
  from_name?: string | null;
  subject?: string | null;
  body_text?: string | null;
  to_address?: string | null;
}

export interface NotifyDecisionInput {
  message: IncomingMessage;
  /** Current route, e.g. "/crm/inbox/<uuid>". */
  pathname: string;
  /** Message ids already announced this session. */
  seenMessageIds: ReadonlySet<string>;
  /** False while the tab is hidden — used to decide desktop vs in-app only. */
  documentVisible?: boolean;
}

export type NotifySkipReason =
  | 'outbound'
  | 'duplicate'
  | 'already-viewing'
  | 'missing-conversation';

export type NotifyDecision =
  | { notify: true }
  | { notify: false; reason: NotifySkipReason };

/**
 * Realtime can redeliver on reconnect and the inbox page inserts outbound
 * replies through the same table, so both are filtered here rather than
 * relying on the subscription filter (postgres_changes supports only a single
 * server-side equality filter, which is spent on org scoping).
 */
export function decideNotify(input: NotifyDecisionInput): NotifyDecision {
  const { message, pathname, seenMessageIds } = input;

  if (message.direction !== 'inbound') return { notify: false, reason: 'outbound' };
  if (!message.conversation_id) return { notify: false, reason: 'missing-conversation' };
  if (seenMessageIds.has(message.id)) return { notify: false, reason: 'duplicate' };

  // Don't announce the thread the agent is already reading. Hidden tabs still
  // notify, because "already viewing" is not true when the tab is in the
  // background.
  const viewingThisThread =
    pathname.includes(message.conversation_id) && input.documentVisible !== false;
  if (viewingThisThread) return { notify: false, reason: 'already-viewing' };

  return { notify: true };
}

/** Strip quoted reply chains and signature noise from a preview snippet. */
export function previewSnippet(bodyText: string | null | undefined): string {
  if (!bodyText) return '';

  const lines = bodyText.split(/\r?\n/);
  const kept: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // A quoted chain or an "On <date> ... wrote:" attribution means everything
    // after it is the previous message, not the new content.
    if (trimmed.startsWith('>')) break;
    if (/^on .+wrote:$/i.test(trimmed)) break;
    if (trimmed === '--' || trimmed === '-- ') break;
    kept.push(trimmed);
  }

  const collapsed = kept.join(' ').replace(/\s+/g, ' ').trim();
  if (collapsed.length <= MAX_SNIPPET_LENGTH) return collapsed;
  return `${collapsed.slice(0, MAX_SNIPPET_LENGTH).trimEnd()}…`;
}

export interface NewMailToast {
  title: string;
  description: string;
  href: string;
  /** Shared mailbox the mail arrived on, when known. */
  mailbox: string | null;
}

function senderLabel(message: IncomingMessage): string {
  const name = message.from_name?.trim();
  if (name) return name;
  const address = message.from_address?.trim();
  if (address) return address;
  return 'Unknown sender';
}

/**
 * Build the announcement.
 *
 * The sender leads the title because that is what an agent scans for. The
 * subject leads the description, with the snippet after it, so the popup is
 * useful even when the body failed to hydrate.
 */
export function buildNewMailToast(message: IncomingMessage): NewMailToast {
  const subject = message.subject?.trim() || '(no subject)';
  const snippet = previewSnippet(message.body_text);

  return {
    title: `New email from ${senderLabel(message)}`,
    description: snippet ? `${subject} — ${snippet}` : subject,
    href: `/crm/inbox/${message.conversation_id}`,
    mailbox: message.to_address?.trim().toLowerCase() || null,
  };
}
