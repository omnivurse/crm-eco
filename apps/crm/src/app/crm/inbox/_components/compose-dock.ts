/**
 * Geometry + data-loss decisions for the docked compose pane.
 *
 * Kept pure (no React, no DOM) so the two rules the client actually cares
 * about — "never discard an email I was writing" and "never drop the draft
 * copy of an email the server only half-delivered" — are unit-tested rather
 * than eyeballed in the browser.
 */

export type ComposeDockSize = 'docked' | 'maximized' | 'minimized';

export const COMPOSE_DOCK_SIZE_KEY = 'crm.inbox.compose.size';

export function parseComposeDockSize(value: string | null | undefined): ComposeDockSize | null {
  return value === 'docked' || value === 'maximized' || value === 'minimized' ? value : null;
}

/**
 * Minimized is a state of one message, not a preference: restoring it for the
 * *next* compose would open a new email as a bar the user has to hunt for.
 */
export function persistableComposeDockSize(size: ComposeDockSize): ComposeDockSize | null {
  return size === 'minimized' ? null : size;
}

/**
 * `--crm-chrome-h` / `--crm-bottombar-h` are the shell's own height tokens
 * (globals.css), so the pane tracks density changes instead of guessing at a
 * pixel offset the way the inbox panes used to.
 */
const DOCK_BASE =
  'fixed z-40 flex flex-col overflow-hidden bg-white text-slate-900 shadow-2xl ' +
  'pb-[env(safe-area-inset-bottom)] focus:outline-none dark:bg-slate-900 dark:text-slate-100';

/** Below `lg` a 55vw pane is a sliver, so the pane takes the whole screen. */
const FULL_SCREEN = 'inset-0';

const WORKSPACE_Y = 'lg:top-[var(--crm-chrome-h)] lg:bottom-[var(--crm-bottombar-h)]';

const EDGE = 'border-slate-200 dark:border-slate-700';

export function composeDockClass(size: ComposeDockSize): string {
  if (size === 'minimized') {
    return (
      `${DOCK_BASE} inset-x-0 bottom-0 top-auto h-auto rounded-t-xl border-t ${EDGE} ` +
      'sm:inset-x-auto sm:right-4 sm:bottom-[calc(var(--crm-bottombar-h)_+_0.75rem)] ' +
      'sm:w-80 sm:max-w-[calc(100vw-2rem)] sm:rounded-xl sm:border'
    );
  }
  if (size === 'maximized') {
    return `${DOCK_BASE} ${FULL_SCREEN} ${WORKSPACE_Y} lg:inset-x-0 lg:w-auto lg:border-t ${EDGE}`;
  }
  return (
    `${DOCK_BASE} ${FULL_SCREEN} ${WORKSPACE_Y} ` +
    `lg:left-auto lg:right-0 lg:w-[min(720px,55vw)] lg:border-l ${EDGE}`
  );
}

/** Label for the minimized bar — an untitled message still needs a handle. */
export function composeDockTitle(subject?: string | null): string {
  return subject?.trim() || 'New message';
}

export function composeHeaderTitle(initialSubject?: string | null): string {
  return initialSubject?.startsWith('Fwd:') ? 'Forward Email' : 'New Email';
}

export interface ComposeRecipient {
  email: string;
  name?: string;
}

export interface ComposeDirtyState {
  to?: readonly ComposeRecipient[] | null;
  cc?: readonly ComposeRecipient[] | null;
  bcc?: readonly ComposeRecipient[] | null;
  subject?: string | null;
  bodyHtml?: string | null;
  attachments?: readonly unknown[] | null;
}

/** Tags that carry content even when they contribute no text. */
const CONTENTFUL_TAG_RE = /<(?:img|table|hr|iframe|video|audio|object|embed)\b/i;

/**
 * TipTap's "empty" document is `<p><br class="ProseMirror-trailingBreak"></p>`
 * and a cleared one is `<p></p>`; treating either as content would put a
 * "you have unsaved changes" wall in front of every abandoned blank compose.
 */
export function htmlHasContent(html?: string | null): boolean {
  if (!html) return false;
  if (CONTENTFUL_TAG_RE.test(html)) return true;
  const text = html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;|&#160;|&#xa0;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 0;
}

/** Content worth a confirm before it is thrown away. */
export function composeIsDirty(state: ComposeDirtyState): boolean {
  const recipients =
    (state.to?.length ?? 0) + (state.cc?.length ?? 0) + (state.bcc?.length ?? 0);
  if (recipients > 0) return true;
  if ((state.subject ?? '').trim().length > 0) return true;
  if ((state.attachments?.length ?? 0) > 0) return true;
  return htmlHasContent(state.bodyHtml);
}

/** The shape `POST /api/communications/send` answers with. */
export interface ComposeSendResult {
  ok: boolean;
  inbox_conversation_id?: string | null;
}

/**
 * The draft is the only copy of a message the inbox failed to record. Deleting
 * it on any 2xx — what this used to do — meant a send that returned without
 * `inbox_conversation_id` left the user with an email in no list at all.
 */
export function shouldDeleteDraftAfterSend(result: ComposeSendResult): boolean {
  return (
    result.ok === true &&
    typeof result.inbox_conversation_id === 'string' &&
    result.inbox_conversation_id.trim().length > 0
  );
}

/**
 * EmailComposer is shared with the campaign and record surfaces and owns its
 * own form state, so the dock cannot read the draft payload or call save
 * directly — it presses the composer's own control. These two constants are
 * the whole coupling; if EmailComposer's markup moves, it moves here.
 */
export const COMPOSE_SAVE_DRAFT_LABEL = 'save draft';
export const COMPOSE_SUBJECT_INPUT_SELECTOR = 'input[placeholder="Enter email subject"]';
export const COMPOSE_BODY_SELECTOR = '.email-composer .ProseMirror';
