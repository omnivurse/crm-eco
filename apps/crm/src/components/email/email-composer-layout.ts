/**
 * Geometry for the shared email composer.
 *
 * A reply quotes the thread in the editor. If the composer is one tall
 * scroll sheet, Send sits under every quoted message. Height-constrained
 * hosts (the inbox dock) pin the action bar; the editor slot is the only
 * scroller. Unbounded hosts (record dialogs) keep the original growing
 * layout so a `flex-1` editor cannot collapse to zero.
 */

const SURFACE =
  'rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900';

const HEADER = 'space-y-4 border-b border-slate-200 p-4 dark:border-slate-700';

const ATTACHMENTS = 'border-t border-slate-200 dark:border-slate-700';

const ACTIONS =
  'flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50';

export function composerRootClass(pinActions: boolean): string {
  return pinActions
    ? `email-composer flex h-full min-h-0 flex-col overflow-hidden ${SURFACE}`
    : `email-composer overflow-hidden ${SURFACE}`;
}

export function composerHeaderClass(pinActions: boolean): string {
  return pinActions
    ? 'shrink-0 space-y-2 border-b border-slate-200 p-3 dark:border-slate-700'
    : HEADER;
}

/** Empty when the host is not height-constrained — do not flex-1 an auto-height parent. */
export function composerEditorSlotClass(pinActions: boolean): string {
  return pinActions ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : '';
}

export function composerEditorClass(pinActions: boolean): string {
  return pinActions ? 'h-full min-h-0 flex-1 rounded-none border-0' : 'rounded-none border-0';
}

export function composerAttachmentsClass(pinActions: boolean): string {
  return pinActions ? `max-h-40 shrink-0 overflow-y-auto ${ATTACHMENTS}` : ATTACHMENTS;
}

export function composerActionsClass(pinActions: boolean): string {
  return pinActions ? `shrink-0 ${ACTIONS}` : ACTIONS;
}
