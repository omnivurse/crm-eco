'use client';

import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase-client';
import {
  Send,
  Loader2,
  Reply,
  ReplyAll,
  Forward,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@crm-eco/ui/lib/utils';
import { LazyEmailEditor } from '@/components/email/LazyEmailEditor';
import type { InboxConversation, InboxMessage } from '@/lib/inbox/types';

type ReplyMode = 'reply' | 'reply_all' | 'forward';

interface ReplyFormProps {
  selectedConversation: InboxConversation;
  messages: InboxMessage[];
  authProfile: { id: string; organization_id: string; full_name: string | null };
  authUserEmail: string;
  onReplySent: (conversationId: string) => void;
  onForward?: (subject: string, body: string) => void;
}

export function ReplyForm({
  selectedConversation,
  messages,
  authProfile,
  authUserEmail,
  onReplySent,
  onForward,
}: ReplyFormProps) {
  const [replyHtml, setReplyHtml] = useState('');
  const [sending, setSending] = useState(false);
  const [replyMode, setReplyMode] = useState<ReplyMode>('reply');
  const [showModeMenu, setShowModeMenu] = useState(false);

  // Find the last inbound message for threading
  const lastInbound = useMemo(() => {
    const inbound = messages.filter(m => m.direction === 'inbound');
    return inbound.length > 0 ? inbound[inbound.length - 1] : null;
  }, [messages]);

  const lastMessage = useMemo(() => {
    return messages.length > 0 ? messages[messages.length - 1] : null;
  }, [messages]);

  // Build CC list for Reply All
  const replyAllCc = useMemo(() => {
    if (!lastInbound) return [];
    const ccList = lastInbound.cc_addresses || [];
    // Filter out our own email from CC
    return ccList.filter(
      (addr: { email: string }) => addr.email.toLowerCase() !== authUserEmail.toLowerCase()
    );
  }, [lastInbound, authUserEmail]);

  const handleSendReply = useCallback(async () => {
    if (!replyHtml.trim() || replyHtml === '<p></p>') {
      toast.error('Please type a reply');
      return;
    }

    // Forward mode: open compose modal with quoted content
    if (replyMode === 'forward' && onForward) {
      const fwdSubject = `Fwd: ${selectedConversation.subject || '(no subject)'}`;
      const quotedBody = buildQuotedBody(lastMessage, replyHtml);
      onForward(fwdSubject, quotedBody);
      setReplyHtml('');
      return;
    }

    setSending(true);
    try {
      const toAddress = lastInbound?.from_address
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

      const bodyText = replyHtml.replace(/<[^>]*>/g, '');

      // Build CC list for Reply All
      const ccEmails = replyMode === 'reply_all' ? replyAllCc.map(r => r.email) : [];

      // Send via Resend
      const res = await fetch('/api/communications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'email',
          to: toAddress,
          subject: replySubject,
          body_html: replyHtml,
          body_text: bodyText,
          cc: ccEmails,
          from_name: authProfile.full_name || authUserEmail,
          reply_to: authUserEmail,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to send reply');

      // Build threading headers
      const messageId = result.message_id
        ? `<${result.message_id}>`
        : `<${crypto.randomUUID()}@mail.payitforwardhealth.com>`;

      const inReplyTo = lastMessage?.message_id || null;
      const existingRefs = lastMessage?.references_ids || [];
      const referencesIds = inReplyTo
        ? [...existingRefs.filter((r: string) => r !== inReplyTo), inReplyTo]
        : existingRefs;

      // Insert inbox_messages record
      const now = new Date().toISOString();
      const { error: insertError } = await supabase.from('inbox_messages').insert({
        org_id: authProfile.organization_id,
        conversation_id: selectedConversation.id,
        channel: 'email',
        direction: 'outbound',
        from_name: authProfile.full_name || authUserEmail,
        from_address: authUserEmail,
        to_address: toAddress,
        to_name: lastInbound?.from_name || selectedConversation.contact_name,
        subject: replySubject,
        body_html: replyHtml,
        body_text: bodyText,
        cc_addresses: replyMode === 'reply_all' ? replyAllCc : [],
        bcc_addresses: [],
        message_id: messageId,
        in_reply_to: inReplyTo,
        references_ids: referencesIds.length > 0 ? referencesIds : null,
        status: 'sent',
        sent_at: now,
        external_id: result.message_id || null,
        external_provider: result.provider || null,
        metadata: {},
      });

      if (insertError) {
        console.error('Failed to save reply record:', insertError);
      }

      // Update conversation counters
      await supabase
        .from('inbox_conversations')
        .update({
          message_count: (selectedConversation.message_count || 0) + 1,
          last_message_at: now,
          preview: bodyText.slice(0, 200),
        })
        .eq('id', selectedConversation.id);

      toast.success('Reply sent');
      setReplyHtml('');
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
    lastInbound,
    lastMessage,
    authProfile,
    authUserEmail,
    replyAllCc,
    onReplySent,
    onForward,
  ]);

  const modeOptions: { mode: ReplyMode; label: string; icon: React.ReactNode }[] = [
    { mode: 'reply', label: 'Reply', icon: <Reply className="w-4 h-4" /> },
    { mode: 'reply_all', label: 'Reply All', icon: <ReplyAll className="w-4 h-4" /> },
    { mode: 'forward', label: 'Forward', icon: <Forward className="w-4 h-4" /> },
  ];

  const currentMode = modeOptions.find(m => m.mode === replyMode)!;

  return (
    <div className="border-t border-slate-200 dark:border-slate-700">
      {/* Reply mode selector & CC display */}
      <div className="px-3 lg:px-4 pt-3 flex items-center gap-2">
        <div className="relative">
          <button
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

        {replyMode === 'reply_all' && replyAllCc.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-slate-500 truncate">
            <span className="font-medium">CC:</span>
            <span className="truncate">
              {replyAllCc.map((r: { email: string; name?: string }) => r.name || r.email).join(', ')}
            </span>
          </div>
        )}
      </div>

      {/* Rich text editor */}
      <div className="px-3 lg:px-4 py-2">
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <LazyEmailEditor
            content={replyHtml}
            onChange={setReplyHtml}
            placeholder="Type your reply..."
            minHeight={120}
            className="border-0 rounded-none"
          />
        </div>
      </div>

      {/* Send button */}
      <div className="px-3 lg:px-4 pb-3 flex justify-end">
        <button
          onClick={handleSendReply}
          disabled={(!replyHtml.trim() || replyHtml === '<p></p>') || sending}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : replyMode === 'forward' ? (
            <Forward className="w-4 h-4" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          {sending
            ? 'Sending...'
            : replyMode === 'forward'
            ? 'Forward'
            : 'Send'}
        </button>
      </div>
    </div>
  );
}

/** Build a quoted body for forwarding */
function buildQuotedBody(msg: InboxMessage | null, userContent: string): string {
  if (!msg) return userContent;

  const fromLine = msg.from_name ? `${msg.from_name} &lt;${msg.from_address}&gt;` : msg.from_address;
  const date = new Date(msg.sent_at).toLocaleString();

  return `${userContent}
<br/><br/>
<div style="border-left: 2px solid #ccc; padding-left: 12px; margin-left: 0; color: #555;">
  <p style="margin: 0 0 8px 0; font-size: 12px; color: #888;">
    ---------- Forwarded message ----------<br/>
    From: ${fromLine}<br/>
    Date: ${date}<br/>
    Subject: ${msg.subject || '(no subject)'}
  </p>
  ${msg.body_html || `<p>${msg.body_text || ''}</p>`}
</div>`;
}
