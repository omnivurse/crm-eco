'use client';

/**
 * Compose as a pane of the workspace rather than a dialog over it.
 *
 * The modal this replaces dimmed the whole inbox, so writing an email meant
 * losing sight of the thread being answered, and any Escape or stray click on
 * the overlay threw the message away. This pane docks to the right of the
 * reading column, maximizes, minimizes to a bar, autosaves to `inbox_drafts`,
 * and asks before discarding anything the user typed.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Maximize2, Minimize2, Minus, X } from 'lucide-react';
import { toast } from 'sonner';
import { confirmDialog } from '@crm-eco/ui/components/confirm-dialog';
import { cn } from '@crm-eco/ui/lib/utils';
import { toastCopy } from '@/lib/crm/toast-copy';
import { EmailComposer, type EmailComposerData } from '@/components/email/EmailComposer';
import type { EmailAttachment } from '@/components/email/EmailAttachments';
import { TemplatePicker } from './TemplatePicker';
import { composerDataToCommunicationsSendBody } from '@/lib/email/outbound-attachments';
import {
  COMPOSE_DOCK_SIZE_KEY,
  composeDockClass,
  composeDockTitle,
  composeHeaderTitle,
  parseComposeDockSize,
  persistableComposeDockSize,
  shouldDeleteDraftAfterSend,
  type ComposeDockSize,
} from './compose-dock';

/** Quiet enough not to fight the typist, short enough to survive a crash. */
const AUTOSAVE_MS = 1200;

interface EmailRecipient {
  email: string;
  name?: string;
}

interface ComposeDockProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  authProfile: { id: string; organization_id: string; full_name: string | null };
  authUserEmail: string;
  onMessageSent: () => void;
  /** Draft rows changed (autosave created one, send removed one). */
  onDraftsChanged?: () => void;
  initialTo?: EmailRecipient[];
  initialSubject?: string;
  initialBody?: string;
  initialAttachments?: EmailAttachment[];
  /** Bump on every open so EmailComposer remounts instead of keeping the last message. */
  composerKey: string;
  initialDraftId?: string | null;
  /** Org default sender, used only when no verified address is picked. */
  fallbackEmail: string;
  fallbackName: string;
  /** Reply-To when the chosen From is a no-reply address. */
  fallbackReplyTo: string;
}

function draftPayload(data: EmailComposerData) {
  return {
    to_addresses: data.to,
    cc_addresses: data.cc,
    bcc_addresses: data.bcc,
    subject: data.subject,
    body_html: data.body_html,
    body_text: data.body_text,
    signature_id: data.signature_id || null,
    attachments: data.attachments.map((a) => ({
      filename: a.file_name,
      content_type: a.mime_type,
      size: a.file_size,
      url: a.public_url || null,
      file_path: a.file_path || a.bucket_path || null,
    })),
  };
}

export function ComposeDock({
  open,
  onOpenChange,
  authProfile,
  authUserEmail,
  onMessageSent,
  onDraftsChanged,
  initialTo,
  initialSubject,
  initialBody,
  initialAttachments,
  composerKey,
  initialDraftId,
  fallbackEmail,
  fallbackName,
  fallbackReplyTo,
}: ComposeDockProps) {
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [templateSubject, setTemplateSubject] = useState<string | undefined>();
  const [templateBody, setTemplateBody] = useState<string | undefined>();
  /**
   * Size is a per-user habit; minimized is a state of one message, so
   * `persistableComposeDockSize` refuses to remember it. Read at mount rather
   * than in an effect: the dock renders nothing until it is opened, so there is
   * no server markup for a localStorage-derived value to disagree with.
   */
  const [size, setSize] = useState<ComposeDockSize>(
    () =>
      parseComposeDockSize(
        typeof window === 'undefined' ? null : window.localStorage.getItem(COMPOSE_DOCK_SIZE_KEY),
      ) ?? 'docked',
  );
  const [dirty, setDirty] = useState(false);
  const [savedSubject, setSavedSubject] = useState<string | undefined>(initialSubject);
  const draftIdRef = useRef<string | null>(initialDraftId ?? null);
  const paneRef = useRef<HTMLDivElement>(null);

  const applySize = useCallback((next: ComposeDockSize) => {
    setSize(next);
    const persistable = persistableComposeDockSize(next);
    if (persistable && typeof window !== 'undefined') {
      window.localStorage.setItem(COMPOSE_DOCK_SIZE_KEY, persistable);
    }
  }, []);

  // Focus the pane when it opens so Escape and Tab start inside the message
  // rather than back in the conversation list.
  useEffect(() => {
    if (!open || size === 'minimized') return;
    paneRef.current?.focus({ preventScroll: true });
  }, [open, composerKey, size]);

  const saveDraft = useCallback(async (data: EmailComposerData) => {
    const payload = draftPayload(data);
    setSavedSubject(data.subject);
    if (draftIdRef.current) {
      const res = await fetch(`/api/inbox/drafts/${draftIdRef.current}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to save draft');
      return;
    }
    const res = await fetch('/api/inbox/drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok || !result.draft?.id) throw new Error(result.error || 'Failed to save draft');
    draftIdRef.current = result.draft.id;
    onDraftsChanged?.();
  }, [onDraftsChanged]);

  const close = useCallback(
    async (force = false) => {
      if (!force && dirty) {
        const keep = await confirmDialog({
          title: 'Keep this message?',
          description:
            'It is saved in Drafts. Discard removes it — the text and any attachments are gone.',
          confirmLabel: 'Keep in Drafts',
          cancelLabel: 'Discard',
        });
        if (!keep) {
          // Discard means discard: delete the autosaved row too, otherwise
          // Drafts fills with messages the user explicitly threw away.
          if (draftIdRef.current) {
            await fetch(`/api/inbox/drafts/${draftIdRef.current}`, { method: 'DELETE' }).catch(
              () => undefined,
            );
            draftIdRef.current = null;
            onDraftsChanged?.();
          }
        } else {
          onDraftsChanged?.();
        }
      }
      setDirty(false);
      setTemplateSubject(undefined);
      setTemplateBody(undefined);
      onOpenChange(false);
    },
    [dirty, onDraftsChanged, onOpenChange],
  );

  const handleSend = useCallback(
    async (data: EmailComposerData) => {
      if (data.to.length === 0) throw new Error('At least one recipient is required');

      const fromEmail = data.from_email || fallbackEmail;
      const fromName = data.from_name || fallbackName;
      const replyTo = fromEmail.startsWith('noreply@') ? fallbackReplyTo : fromEmail;

      const res = await fetch('/api/communications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...composerDataToCommunicationsSendBody({
            ...data,
            from_email: fromEmail,
            from_name: fromName,
            reply_to: replyTo,
          }),
          persist_inbox: true,
          to_name: data.to[0].name,
        }),
      });

      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Failed to send email');

      // The draft is the only copy of a message the inbox failed to record, so
      // it is deleted on a proven file — not on any 2xx.
      if (draftIdRef.current && shouldDeleteDraftAfterSend({ ok: res.ok, ...result })) {
        await fetch(`/api/inbox/drafts/${draftIdRef.current}`, { method: 'DELETE' }).catch(
          () => undefined,
        );
        draftIdRef.current = null;
      } else if (!result.inbox_conversation_id) {
        toast.warning(
          toastCopy.failed(
            'file this email in the inbox',
            'it was sent, but no conversation was created — the draft is kept',
          ),
        );
      }

      setDirty(false);
      onOpenChange(false);
      onMessageSent();
      onDraftsChanged?.();
    },
    [fallbackEmail, fallbackName, fallbackReplyTo, onDraftsChanged, onMessageSent, onOpenChange],
  );

  const handleSchedule = useCallback(
    async (data: EmailComposerData, scheduledAt: Date) => {
      if (data.to.length === 0) throw new Error('At least one recipient is required');
      const payload = { ...draftPayload(data), scheduled_at: scheduledAt.toISOString() };

      if (draftIdRef.current) {
        const res = await fetch(`/api/inbox/drafts/${draftIdRef.current}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const result = await res.json().catch(() => ({}));
          throw new Error(result.error || 'Failed to schedule email');
        }
      } else {
        const res = await fetch('/api/inbox/drafts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok || !result.draft?.id) throw new Error(result.error || 'Failed to schedule email');
      }

      draftIdRef.current = null;
      setDirty(false);
      onOpenChange(false);
      onDraftsChanged?.();
    },
    [onDraftsChanged, onOpenChange],
  );

  const handleTemplateSelect = useCallback((template: { subject: string; body_html: string }) => {
    setTemplateSubject(template.subject);
    setTemplateBody(template.body_html);
    toast.success(toastCopy.applied('Template'));
  }, []);

  if (!open) return null;

  const minimized = size === 'minimized';

  return (
    <>
      <div
        ref={paneRef}
        tabIndex={-1}
        role="region"
        aria-label={composeHeaderTitle(initialSubject)}
        onKeyDown={(event) => {
          // Escape belongs to the composer while it is focused; the page-level
          // handler that closes the reading pane must not also fire.
          if (event.key === 'Escape') {
            event.stopPropagation();
            void close();
          }
        }}
        className={composeDockClass(size)}
      >
        <div
          className={cn(
            'flex shrink-0 items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60',
            minimized && 'border-b-0',
          )}
        >
          <button
            type="button"
            onClick={() => applySize(minimized ? 'docked' : 'minimized')}
            className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold text-slate-800 dark:text-slate-100"
            title={minimized ? 'Restore message' : 'Minimize message'}
          >
            {minimized ? composeDockTitle(savedSubject) : composeHeaderTitle(initialSubject)}
          </button>

          {!minimized && (
            <button
              type="button"
              onClick={() => setShowTemplatePicker(true)}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium text-slate-600 transition-colors hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <FileText className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden sm:inline">Templates</span>
            </button>
          )}

          <div className="flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => applySize(minimized ? 'docked' : 'minimized')}
              aria-label={minimized ? 'Restore message' : 'Minimize message'}
              title={minimized ? 'Restore' : 'Minimize'}
              className="rounded p-1.5 text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <Minus className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => applySize(size === 'maximized' ? 'docked' : 'maximized')}
              aria-label={size === 'maximized' ? 'Restore down' : 'Maximize message'}
              title={size === 'maximized' ? 'Restore down' : 'Maximize'}
              className="hidden rounded p-1.5 text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white lg:inline-flex"
            >
              {size === 'maximized' ? (
                <Minimize2 className="h-4 w-4" aria-hidden />
              ) : (
                <Maximize2 className="h-4 w-4" aria-hidden />
              )}
            </button>
            <button
              type="button"
              onClick={() => void close()}
              aria-label="Close message"
              title="Close"
              className="rounded p-1.5 text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        {/* Kept mounted while minimized: unmounting the composer would discard
            every unsaved edit the bar exists to protect. */}
        <div className={cn('min-h-0 flex-1 overflow-y-auto', minimized && 'hidden')}>
          <EmailComposer
            key={composerKey}
            initialTo={initialTo}
            initialSubject={templateSubject ?? initialSubject}
            initialBody={templateBody ?? initialBody}
            initialAttachments={initialAttachments}
            onSend={handleSend}
            onSave={saveDraft}
            onSchedule={handleSchedule}
            onCancel={() => void close()}
            onDirtyChange={setDirty}
            autosaveMs={AUTOSAVE_MS}
            showSchedule
            showSave
            showAttachments
            showSignatures
            fallbackEmail={fallbackEmail}
            fallbackName={fallbackName}
            className="rounded-none border-0 shadow-none"
          />
        </div>
      </div>

      <TemplatePicker
        open={showTemplatePicker}
        nonModal
        onClose={() => setShowTemplatePicker(false)}
        onSelect={handleTemplateSelect}
      />
    </>
  );
}
