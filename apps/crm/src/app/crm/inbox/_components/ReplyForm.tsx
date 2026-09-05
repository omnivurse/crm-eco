'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Send,
  Loader2,
  Reply,
  ReplyAll,
  Forward,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  FileSignature,
  Star,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { toast } from 'sonner';
import { toastCopy } from '@/lib/crm/toast-copy';
import { cn } from '@crm-eco/ui/lib/utils';
import { LazyEmailEditor } from '@/components/email/LazyEmailEditor';
import { EmailAttachments, type EmailAttachment } from '@/components/email/EmailAttachments';
import type { InboxConversation, InboxMessage } from '@/lib/inbox/types';
import type { SharedMailbox } from '@/lib/inbox/shared-mailboxes';
import { resolveReplyFromAddress } from '@/lib/inbox/reply-from';
import {
  assertComposerAttachmentsReady,
  composerAttachmentsToRefs,
} from '@/lib/email/outbound-attachments';
import {
  buildForwardedBody,
  forwardSubject,
  forwardableAttachments,
  pickForwardSource,
  unforwardableAttachmentCount,
} from './inbox-forward';
import {
  appendSignatureHtml,
  buildReplyQuotedHtml,
  replyHasUserContent,
} from './inbox-reply';
import { useEmailSignatures } from '@/hooks/useEmailSignatures';
import {
  REPLY_DRAFT_DEBOUNCE_MS,
  buildReplyDraftPayload,
  findReplyDraft,
  replyDraftHasContent,
  replyDraftLabel,
  resolveReplyDraftStatus,
  restoreReplyDraft,
  shouldDeleteReplyDraft,
} from './reply-draft';
import type { InboxDraft } from '@/lib/inbox/types';
import {
  buildReferencesChain,
  parseMessageIdHeader,
} from '../../../../../../../supabase/functions/_shared/rfc822-headers';

type ReplyMode = 'reply' | 'reply_all';

/**
 * In-tab per-conversation reply drafts.
 *
 * Still here after server persistence landed, because it covers what the
 * server cannot: the gap between a keystroke and the debounced write, and the
 * case where `inbox_drafts` refuses the write (its RLS repair may not be
 * applied yet). `reply-draft.ts` decides which copy wins on restore, and the
 * dock label never claims "saved" unless the server actually said so.
 */
const replyDraftCache = new Map<string, { html: string; attachments: EmailAttachment[] }>();

interface ReplyFormProps {
  selectedConversation: InboxConversation;
  messages: InboxMessage[];
  authProfile: { id: string; organization_id: string; full_name: string | null };
  authUserEmail: string;
  /** Verified sender registry, used to pick the From address. */
  mailboxes?: SharedMailbox[];
  verifiedDomains?: string[];
  onReplySent: (conversationId: string) => void;
  onForward?: (subject: string, body: string, attachments?: EmailAttachment[]) => void;
  /** Increment to force the dock open (e.g. Reply on a message card). */
  expandToken?: number;
  /**
   * Mode the ribbon asked for, applied on the same token as `expandToken`.
   * Only honoured when the token moves, so choosing Reply inside the composer
   * is never overridden by the button that opened it.
   */
  expandMode?: ReplyMode;
  /**
   * Drafts the page already loaded. Reused instead of a per-thread fetch so
   * opening a conversation costs nothing extra.
   */
  drafts?: InboxDraft[];
  /** Refresh the Drafts folder after this composer creates or clears a row. */
  onDraftsChanged?: () => void;
}

export function ReplyForm({
  selectedConversation,
  messages,
  authProfile,
  authUserEmail,
  mailboxes = [],
  verifiedDomains = [],
  onReplySent,
  onForward,
  expandToken = 0,
  expandMode,
  drafts = [],
  onDraftsChanged,
}: ReplyFormProps) {
  const [replyHtml, setReplyHtml] = useState('');
  const [sending, setSending] = useState(false);
  const [replyMode, setReplyMode] = useState<ReplyMode>('reply');
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [attachments, setAttachments] = useState<EmailAttachment[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [editorMounted, setEditorMounted] = useState(false);
  const { signatures, signatureId, setSignatureId, selectedSignature, loadingSignatures } =
    useEmailSignatures('reply');

  const hasDraft = replyDraftHasContent(replyHtml, attachments);

  /** Row id in `inbox_drafts` once the server has accepted one for this thread. */
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftSaving, setDraftSaving] = useState(false);
  /**
   * Fingerprint of the content the server last acknowledged. Comparing against
   * the live content is what lets the label say "saved" only when it is true.
   */
  const savedFingerprintRef = useRef<string | null>(null);

  const draftFingerprint = useMemo(
    () => `${replyHtml}::${attachments.map((a) => a.file_path || a.bucket_path || a.id).join(',')}`,
    [replyHtml, attachments],
  );

  const draftStatus = resolveReplyDraftStatus({
    hasContent: hasDraft,
    saving: draftSaving,
    serverMatchesContent: savedFingerprintRef.current === draftFingerprint,
  });

  // Which conversation the current editor state belongs to. Updated only by
  // the restore effect below, so the stash effect (declared first — effects
  // run in declaration order) always writes under the id the text was typed
  // in, never the id we are switching to.
  const draftOwnerIdRef = useRef(selectedConversation.id);

  // Keep the cache in sync while typing so a conversation switch or an
  // unmount (Escape, back-to-list, route change) can never lose work.
  useEffect(() => {
    const owner = draftOwnerIdRef.current;
    if (hasDraft) {
      replyDraftCache.set(owner, { html: replyHtml, attachments });
    } else {
      replyDraftCache.delete(owner);
    }
  }, [selectedConversation.id, replyHtml, attachments, hasDraft]);

  // Read through a ref so a Drafts-folder refresh cannot re-run the restore
  // below and overwrite what the user is typing.
  const draftsRef = useRef(drafts);
  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  // On conversation switch: restore that conversation's in-progress draft —
  // whichever copy is newer. The in-tab copy wins over the stored row because
  // it may hold keystrokes the debounce has not flushed yet; the stored row is
  // what survives a reload.
  useEffect(() => {
    draftOwnerIdRef.current = selectedConversation.id;
    const restored = restoreReplyDraft({
      cached: replyDraftCache.get(selectedConversation.id),
      saved: findReplyDraft(draftsRef.current, selectedConversation.id),
    });
    setComposerOpen(false);
    setComposerExpanded(false);
    setReplyHtml(restored?.html ?? '');
    setAttachments(restored?.attachments ?? []);
    setDraftId(restored?.draftId ?? null);
    // A restored draft has not been re-acknowledged for this session, so the
    // label starts honest and upgrades on the first successful save.
    savedFingerprintRef.current = null;
    setReplyMode('reply');
    setShowModeMenu(false);
  }, [selectedConversation.id]);

  // The drafts list loads asynchronously, so on a cold open it can arrive after
  // the restore above ran with nothing. Adopt the stored row then — but only
  // while the composer is still untouched, never over live typing.
  useEffect(() => {
    if (draftId || hasDraft) return;
    const saved = findReplyDraft(drafts, selectedConversation.id);
    if (!saved) return;
    const restored = restoreReplyDraft({ cached: null, saved });
    if (!restored) return;
    setReplyHtml(restored.html);
    setAttachments(restored.attachments);
    setDraftId(restored.draftId);
  }, [drafts, selectedConversation.id, draftId, hasDraft]);

  const lastInbound = useMemo(() => {
    const inbound = messages.filter(m => m.direction === 'inbound');
    return inbound.length > 0 ? inbound[inbound.length - 1] : null;
  }, [messages]);

  const openComposer = useCallback(() => {
    setEditorMounted(true);
    setComposerOpen(true);
    setReplyHtml((current) => {
      if (replyHasUserContent(current) || current.includes('data-crm-quote')) return current;
      const cached = replyDraftCache.get(selectedConversation.id);
      if (cached && (replyHasUserContent(cached.html) || cached.html.includes('data-crm-quote'))) {
        return cached.html;
      }
      return buildReplyQuotedHtml(lastInbound) || current;
    });
  }, [lastInbound, selectedConversation.id]);

  const closeComposer = useCallback(() => {
    setComposerOpen(false);
    setComposerExpanded(false);
    setShowModeMenu(false);
  }, []);

  // Keyed on the token, not on expandMode: the mode is what the button that
  // opened the composer asked for, and re-applying it on every render would
  // fight a user who then switched to plain Reply.
  const appliedExpandToken = useRef(0);
  useEffect(() => {
    if (expandToken <= 0 || appliedExpandToken.current === expandToken) return;
    appliedExpandToken.current = expandToken;
    if (expandMode) setReplyMode(expandMode);
    openComposer();
  }, [expandToken, expandMode, openComposer]);

  const lastMessage = useMemo(() => {
    return messages.length > 0 ? messages[messages.length - 1] : null;
  }, [messages]);

  /**
   * Shared mailbox this reply goes out as (support@, billing@, …).
   * Driven by the thread's mailbox plus the verified sender registry, so it
   * stays correct for any org rather than assuming one hardcoded domain.
   */
  const monitoredFrom = useMemo(
    () =>
      resolveReplyFromAddress({
        conversationMailbox: selectedConversation.mailbox_address,
        lastInboundTo: lastInbound?.to_address,
        lastInboundReplyTo: lastInbound?.reply_to_address,
        senders: mailboxes.map((m) => ({ email: m.email, isDefault: m.isDefault })),
        verifiedDomains,
      }),
    [selectedConversation.mailbox_address, lastInbound, mailboxes, verifiedDomains],
  );

  /** Display name: a person mailbox signs as the person, role boxes as the org. */
  const fromName = useMemo(() => {
    const match = mailboxes.find((m) => m.email === monitoredFrom);
    return match?.name || 'Pay It Forward Health';
  }, [mailboxes, monitoredFrom]);

  // Build CC list for Reply All
  const replyAllCc = useMemo(() => {
    if (!lastInbound) return [];
    const ccList = lastInbound.cc_addresses || [];
    // Filter out our own monitored mailbox + agent email from CC
    return ccList.filter((addr: { email: string }) => {
      const email = addr.email.toLowerCase();
      return email !== authUserEmail.toLowerCase() && email !== monitoredFrom;
    });
  }, [lastInbound, authUserEmail, monitoredFrom]);

  /**
   * Multi-party threads default to Reply All.
   *
   * A plain Reply silently drops everyone who was CC'd, so the colleagues who
   * are following the thread never see the answer and keep re-asking. Defaulted
   * once per conversation, after its messages load, so an explicit switch to
   * Reply is never overridden while composing.
   */
  const modeDefaultedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!lastInbound) return;
    if (modeDefaultedFor.current === selectedConversation.id) return;
    modeDefaultedFor.current = selectedConversation.id;
    setReplyMode(replyAllCc.length > 0 ? 'reply_all' : 'reply');
  }, [selectedConversation.id, lastInbound, replyAllCc]);

  /**
   * Persist the half-written reply so a reload, a sign-out or a crashed tab
   * cannot throw it away. Debounced on the same cadence as list preferences.
   *
   * Deliberately quiet: a refused write (RLS not yet repaired, offline) leaves
   * the in-tab copy in place and downgrades the label to "kept in this tab"
   * rather than interrupting the writer with a toast they cannot act on.
   */
  const draftIdRef = useRef<string | null>(null);
  useEffect(() => {
    draftIdRef.current = draftId;
  }, [draftId]);

  useEffect(() => {
    const conversationId = selectedConversation.id;
    if (!hasDraft) return;
    if (savedFingerprintRef.current === draftFingerprint) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      const payload = buildReplyDraftPayload({
        conversationId,
        replyMode,
        subject: selectedConversation.subject,
        bodyHtml: replyHtml,
        toAddress:
          lastInbound?.reply_to_address ||
          lastInbound?.from_address ||
          selectedConversation.contact_email,
        toName: lastInbound?.from_name ?? selectedConversation.contact_name,
        ccAddresses: replyAllCc,
        signatureId,
        attachments,
      });

      setDraftSaving(true);
      try {
        const existing = draftIdRef.current;
        const res = existing
          ? await fetch(`/api/inbox/drafts/${existing}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            })
          : await fetch('/api/inbox/drafts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });

        if (cancelled) return;
        if (!res.ok) return;

        const json = await res.json().catch(() => ({}));
        const id = json?.draft?.id as string | undefined;
        if (cancelled) return;
        // Guard against a late response landing after the user moved on: the
        // id belongs to the thread it was written for, not the open one.
        if (draftOwnerIdRef.current !== conversationId) return;
        if (id && !existing) {
          setDraftId(id);
          onDraftsChanged?.();
        }
        savedFingerprintRef.current = draftFingerprint;
      } catch {
        // Network failure — the in-tab copy still holds the text.
      } finally {
        if (!cancelled) setDraftSaving(false);
      }
    }, REPLY_DRAFT_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // `draftFingerprint` is the content trigger; the rest are read at flush time.
  }, [
    draftFingerprint,
    hasDraft,
    selectedConversation.id,
    selectedConversation.subject,
    selectedConversation.contact_email,
    selectedConversation.contact_name,
    replyMode,
    replyHtml,
    lastInbound,
    replyAllCc,
    signatureId,
    attachments,
    onDraftsChanged,
  ]);

  /**
   * Clearing the composer should retire the stored row too, otherwise the
   * Drafts folder keeps offering an empty reply the user already abandoned.
   */
  const discardDraftRow = useCallback(
    async (opts: { sent: boolean }) => {
      const id = draftIdRef.current;
      if (!shouldDeleteReplyDraft({ draftId: id, hasContent: hasDraft, sent: opts.sent })) return;
      setDraftId(null);
      savedFingerprintRef.current = null;
      try {
        await fetch(`/api/inbox/drafts/${id}`, { method: 'DELETE' });
        onDraftsChanged?.();
      } catch {
        // A stranded row is recoverable from the Drafts folder; losing the
        // sent email would not be, so this never blocks the send path.
      }
    },
    [hasDraft, onDraftsChanged],
  );

  const beginForward = useCallback((source?: InboxMessage | null) => {
    if (!onForward) return;
    const forwardSource = source ?? pickForwardSource(messages);
    const note = !replyHtml.trim() || replyHtml === '<p></p>' ? '' : replyHtml;
    const skipped = unforwardableAttachmentCount(forwardSource, attachments);
    if (skipped > 0) {
      toast.warning(
        toastCopy.failed(
          `include ${skipped} ${toastCopy.pluralize('attachment', skipped)}`,
          undefined,
          `download and re-attach ${skipped > 1 ? 'them' : 'it'}`,
        ),
      );
    }
    onForward(
      forwardSubject(selectedConversation.subject || forwardSource?.subject),
      buildForwardedBody(forwardSource, note),
      forwardableAttachments(forwardSource, attachments),
    );
    // The note moved into the forward composer, so this thread's reply row is
    // no longer the live copy of that text.
    void discardDraftRow({ sent: true });
    replyDraftCache.delete(selectedConversation.id);
    setReplyHtml('');
    setAttachments([]);
    setComposerOpen(false);
    setComposerExpanded(false);
  }, [
    attachments,
    discardDraftRow,
    messages,
    onForward,
    replyHtml,
    selectedConversation.id,
    selectedConversation.subject,
  ]);

  const handleSendReply = useCallback(async () => {
    if (!replyHasUserContent(replyHtml)) {
      toast.error('Please type a reply');
      return;
    }

    try {
      assertComposerAttachmentsReady(attachments);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Attachments are not ready');
      return;
    }

    setSending(true);
    try {
      // Honour Reply-To: send-on-behalf systems (HR platforms, ticketing,
      // no-reply gateways) set it precisely because from_address is a black
      // hole. Falls back to the visible sender, then the contact.
      const toAddress = lastInbound?.reply_to_address
        || lastInbound?.from_address
        || selectedConversation.contact_email
        || selectedConversation.contact_phone;

      if (!toAddress) {
        throw new Error('No recipient address found');
      }

      const replySubject = selectedConversation.subject
        ? (selectedConversation.subject.startsWith('Re:')
          ? selectedConversation.subject
          : `Re: ${selectedConversation.subject}`)
        : 'Re:';

      if (!monitoredFrom) {
        throw new Error(
          'No verified sending address is configured. Add one in Settings → Email Domains.',
        );
      }

      const bodyHtml = appendSignatureHtml(replyHtml, selectedSignature?.content_html);
      const bodyText = bodyHtml.replace(/<[^>]*>/g, '');

      // Build CC list for Reply All
      const ccEmails = replyMode === 'reply_all' ? replyAllCc.map(r => r.email) : [];

      const attachmentRefs = composerAttachmentsToRefs(attachments);

      // Rebuilt from the whole thread rather than the last row alone: one
      // malformed stored value used to truncate the chain, and a reply with a
      // broken References header makes the recipient's client fork the thread.
      const inReplyTo = parseMessageIdHeader(lastMessage?.message_id);
      const referencesIds = buildReferencesChain(messages, inReplyTo);

      // Send via Resend. The server persists the outbound inbox row and
      // conversation counters (trigger) so the client does not double-write.
      const res = await fetch('/api/communications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'email',
          to: toAddress,
          to_name: lastInbound?.from_name || selectedConversation.contact_name,
          subject: replySubject,
          body_html: bodyHtml,
          body_text: bodyText,
          cc: ccEmails,
          from_email: monitoredFrom,
          from_name: fromName,
          reply_to: monitoredFrom,
          attachments: attachmentRefs,
          conversation_id: selectedConversation.id,
          in_reply_to: inReplyTo,
          references: referencesIds,
          persist_inbox: true,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to send reply');

      toast.success('Reply sent');
      replyDraftCache.delete(selectedConversation.id);
      // The email now exists in the thread, so the draft row is redundant.
      void discardDraftRow({ sent: true });
      setReplyHtml('');
      setAttachments([]);
      setComposerOpen(false);
      setComposerExpanded(false);
      onReplySent(selectedConversation.id);
    } catch (error) {
      console.error('Failed to send reply:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send reply');
    } finally {
      setSending(false);
    }
  }, [
    replyHtml,
    replyMode,
    selectedConversation,
    messages,
    lastInbound,
    lastMessage,
    authProfile,
    authUserEmail,
    monitoredFrom,
    fromName,
    replyAllCc,
    onReplySent,
    attachments,
    selectedSignature,
  ]);

  const modeOptions: { mode: ReplyMode; label: string; icon: React.ReactNode }[] = [
    { mode: 'reply', label: 'Reply', icon: <Reply className="w-4 h-4" /> },
    { mode: 'reply_all', label: 'Reply All', icon: <ReplyAll className="w-4 h-4" /> },
  ];

  const currentMode = modeOptions.find(m => m.mode === replyMode)!;

  return (
    <div
      className={cn(
        'border-t border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/80 flex flex-col min-h-0 shrink-0',
        // A share of the reading column, not a fixed rem box. The old
        // min(28vh,18rem) dock left roughly four visible lines to type a
        // business reply in, and shrank further on a laptop; half the column
        // is Outlook's inline reply, and Expand takes most of it.
        composerOpen && (composerExpanded ? 'h-[78%] min-h-[16rem]' : 'h-1/2 min-h-[13rem]'),
      )}
    >
      <div className="flex items-stretch shrink-0">
        <button
          type="button"
          aria-expanded={composerOpen}
          aria-controls="inbox-reply-composer"
          aria-label={composerOpen ? 'Collapse reply' : 'Open reply'}
          onClick={() => (composerOpen ? closeComposer() : openComposer())}
          className="flex-1 flex items-center justify-between gap-3 px-3 lg:px-4 py-2.5 text-left hover:bg-slate-100/80 dark:hover:bg-slate-800/70 transition-colors"
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <span className="inline-flex items-center rounded-md bg-slate-200/90 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              Reply
            </span>
            <span className="text-sm text-slate-500 dark:text-slate-400 truncate">
              {hasDraft
                ? replyDraftLabel(draftStatus)
                : composerOpen
                  ? monitoredFrom
                    ? `Replying as ${monitoredFrom}`
                    : 'Write a reply'
                  : monitoredFrom
                    ? `Reply as ${monitoredFrom}`
                    : 'Write a reply'}
            </span>
          </span>
          {composerOpen ? (
            <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" aria-hidden />
          ) : (
            <ChevronUp className="w-4 h-4 shrink-0 text-slate-400" aria-hidden />
          )}
        </button>
        {composerOpen && (
          <button
            type="button"
            onClick={() => setComposerExpanded((open) => !open)}
            className="px-3 hover:bg-slate-100/80 dark:hover:bg-slate-800/70 text-slate-400 transition-colors"
            aria-pressed={composerExpanded}
            aria-label={composerExpanded ? 'Shrink reply' : 'Give reply more space'}
            title={composerExpanded ? 'Shrink reply' : 'Give reply more space'}
          >
            {composerExpanded ? (
              <Minimize2 className="w-4 h-4" aria-hidden />
            ) : (
              <Maximize2 className="w-4 h-4" aria-hidden />
            )}
          </button>
        )}
      </div>

      {composerOpen && (
      <div id="inbox-reply-composer" className="flex flex-col flex-1 min-h-0 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      {/* Reply mode selector & CC display */}
      <div className="px-3 lg:px-4 pt-2.5 flex items-center gap-2 shrink-0">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowModeMenu(!showModeMenu)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            {currentMode.icon}
            {currentMode.label}
            <ChevronDown className="w-3 h-3" />
          </button>
          {showModeMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowModeMenu(false)} />
              <div className="absolute bottom-full left-0 mb-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 min-w-[140px]">
                {modeOptions.map(opt => (
                  <button
                    type="button"
                    key={opt.mode}
                    onClick={() => { setReplyMode(opt.mode); setShowModeMenu(false); }}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors first:rounded-t-lg last:rounded-b-lg',
                      opt.mode === replyMode && 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10'
                    )}
                  >
                    {opt.icon}
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {monitoredFrom ? (
          <div className="text-xs text-slate-500 truncate">
            From <span className="font-medium text-slate-700 dark:text-slate-300">{monitoredFrom}</span>
          </div>
        ) : (
          <div className="text-xs text-amber-600 dark:text-amber-500 truncate">
            No verified sending address — configure one in Settings → Email Domains
          </div>
        )}

        {replyMode === 'reply_all' && replyAllCc.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-slate-500 truncate">
            <span className="font-medium">CC:</span>
            <span className="truncate">
              {replyAllCc.map((r: { email: string; name?: string }) => r.name || r.email).join(', ')}
            </span>
          </div>
        )}

        {onForward && (
          <button
            type="button"
            onClick={() => beginForward()}
            className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <Forward className="w-4 h-4" />
            Forward
          </button>
        )}
      </div>

      {/* Rich text editor — fills the dock so composing has real height */}
      <div className="px-3 lg:px-4 py-2 flex-1 min-h-0 flex flex-col">
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden flex-1 min-h-0 flex flex-col">
          {editorMounted && (
            <LazyEmailEditor
              content={replyHtml}
              onChange={setReplyHtml}
              placeholder="Type your reply..."
              minHeight={120}
              showSourceToggle={false}
              className="border-0 rounded-none h-full min-h-0"
            />
          )}
        </div>
      </div>

      <div className="px-3 lg:px-4 pb-3 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <EmailAttachments
            attachments={attachments}
            onAttachmentsChange={setAttachments}
            disabled={sending}
            compact
          />
          <div className="flex items-center gap-1.5 min-w-0">
            <FileSignature className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <Select
              value={signatureId || '__none__'}
              onValueChange={(v) => setSignatureId(v === '__none__' ? '' : v)}
              disabled={sending || loadingSignatures}
            >
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue placeholder="No signature">
                  {loadingSignatures ? 'Loading…' : selectedSignature ? selectedSignature.name : 'No signature'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No signature</SelectItem>
                {signatures.map((sig) => (
                  <SelectItem key={sig.id} value={sig.id}>
                    <span className="flex items-center gap-1">
                      {sig.name}
                      {sig.is_default && <Star className="w-3 h-3 text-amber-500 fill-current" />}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSendReply}
          disabled={!replyHasUserContent(replyHtml) || sending || attachments.some((a) => a.is_uploading)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium rounded-lg transition-colors"
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          {sending ? 'Sending...' : 'Send'}
        </button>
      </div>
      </div>
      )}
    </div>
  );
}
