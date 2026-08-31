'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  MessageSquare,
  Clock,
  Check,
  CheckCheck,
  Loader2,
  CalendarPlus,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Paperclip,
  Download,
  Users,
} from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import { Avatar, AvatarFallback } from '@crm-eco/ui/components/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { toast } from 'sonner';
import type { InboxConversation, InboxMessage, InboxChannel, ConversationStatus } from '@/lib/inbox/types';
import {
  EMAIL_IFRAME_SANDBOX,
  attachmentByteSize,
  emailIframeHeight,
  formatInboxFileSize,
  measureEmailDocument,
  readingPaneFloor,
  sanitizeEmailForReading,
} from './inbox-reading';
import { participantsFromThread } from '@/lib/calendar/thread-participants';

const MeetingComposer = dynamic(
  () => import('@/components/calendar/MeetingComposer').then((mod) => mod.MeetingComposer),
  { ssr: false },
);

const CHANNEL_ICONS: Record<InboxChannel, React.ReactNode> = {
  email: <span className="w-4 h-4 inline-flex items-center justify-center">✉</span>,
  sms: <span className="w-4 h-4 inline-flex items-center justify-center">💬</span>,
  whatsapp: <span className="w-4 h-4 inline-flex items-center justify-center">📱</span>,
  phone: <span className="w-4 h-4 inline-flex items-center justify-center">📞</span>,
  video: <span className="w-4 h-4 inline-flex items-center justify-center">🎥</span>,
  chat: <span className="w-4 h-4 inline-flex items-center justify-center">💭</span>,
  social: <span className="w-4 h-4 inline-flex items-center justify-center">🔗</span>,
  support: <span className="w-4 h-4 inline-flex items-center justify-center">❓</span>,
};

const CHANNEL_COLORS: Record<InboxChannel, string> = {
  email: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-500/20',
  sms: 'text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-500/20',
  whatsapp: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-500/20',
  phone: 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-500/20',
  video: 'text-violet-600 bg-violet-100 dark:text-violet-400 dark:bg-violet-500/20',
  chat: 'text-indigo-600 bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-500/20',
  social: 'text-pink-600 bg-pink-100 dark:text-pink-400 dark:bg-pink-500/20',
  support: 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-500/20',
};

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (days === 1) {
    return 'Yesterday';
  } else if (days < 7) {
    return `${days}d ago`;
  } else {
    return date.toLocaleDateString();
  }
}

function formatFullDate(dateStr: string) {
  return new Date(dateStr).toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getInitials(name: string | null) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}


interface MessageThreadProps {
  conversation: InboxConversation;
  messages: InboxMessage[];
  loadingMessages: boolean;
  onStatusChange: (conversationId: string, status: ConversationStatus) => void;
  onBackToList: () => void;
}

function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    const style = getComputedStyle(node);
    if (style.overflowY === 'auto' || style.overflowY === 'scroll') return node;
    node = node.parentElement;
  }
  return null;
}

/** Renders HTML email body in a sandboxed iframe that auto-sizes to content */
function HtmlEmailBody({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(() =>
    readingPaneFloor(0, typeof window !== 'undefined' ? window.innerHeight : 800),
  );
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setDark(root.classList.contains('dark'));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const imageCleanups: Array<() => void> = [];
    const resizeObserver = new ResizeObserver(() => applyMeasure());

    const paneFloorNow = () => {
      const pane = findScrollParent(iframe);
      return readingPaneFloor(
        pane?.clientHeight ?? 0,
        window.innerHeight,
      );
    };

    const applyMeasure = () => {
      try {
        const doc = iframe.contentDocument;
        const measured = doc ? measureEmailDocument(doc) : 80;
        setHeight(emailIframeHeight(measured, paneFloorNow()));
      } catch {
        setHeight(emailIframeHeight(80, paneFloorNow()));
      }
    };

    const watchImages = (doc: Document) => {
      imageCleanups.splice(0).forEach((fn) => fn());
      doc.querySelectorAll('img').forEach((img) => {
        if (img.complete) return;
        const onDone = () => applyMeasure();
        img.addEventListener('load', onDone);
        img.addEventListener('error', onDone);
        imageCleanups.push(() => {
          img.removeEventListener('load', onDone);
          img.removeEventListener('error', onDone);
        });
      });
    };

    const watchDocument = () => {
      applyMeasure();
      try {
        const doc = iframe.contentDocument;
        if (!doc) return;
        if (doc.documentElement) resizeObserver.observe(doc.documentElement);
        if (doc.body) resizeObserver.observe(doc.body);
        watchImages(doc);
      } catch {
        // ignore
      }
      requestAnimationFrame(applyMeasure);
    };

    iframe.addEventListener('load', watchDocument);
    // srcDoc often finishes before addEventListener — measure now too.
    watchDocument();

    const pane = findScrollParent(iframe);
    if (pane) resizeObserver.observe(pane);

    return () => {
      iframe.removeEventListener('load', watchDocument);
      resizeObserver.disconnect();
      imageCleanups.splice(0).forEach((fn) => fn());
    };
  }, [html, dark]);

  // Sanitize synchronously in the srcDoc build (never in a later effect) so
  // the iframe never gets even one frame of unsanitized markup.
  const safeHtml = useMemo(() => sanitizeEmailForReading(html), [html]);

  const srcDoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    html, body {
      margin: 0;
      padding: 0;
      overflow: visible;
      background: ${dark ? '#1e293b' : '#ffffff'};
      color: ${dark ? '#e2e8f0' : '#1e293b'};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    img { max-width: 100%; height: auto; }
    a { color: #0d9488; }
    blockquote {
      border-left: 3px solid ${dark ? '#334155' : '#e2e8f0'};
      margin: 8px 0;
      padding: 4px 12px;
      color: ${dark ? '#94a3b8' : '#64748b'};
    }
    pre { overflow-x: auto; background: ${dark ? '#0f172a' : '#f8fafc'}; padding: 8px; border-radius: 4px; }
  </style>
</head>
<body>${safeHtml}</body>
</html>`;

  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcDoc}
      sandbox={EMAIL_IFRAME_SANDBOX}
      className="w-full border-0"
      style={{ height: `${height}px`, minHeight: height, overflow: 'hidden' }}
      title="Email content"
    />
  );
}

/** Single email message in the thread */
function EmailMessage({ msg }: { msg: InboxMessage }) {
  const [expanded, setExpanded] = useState(true);
  const isOutbound = msg.direction === 'outbound';
  const hasHtml = !!msg.body_html;
  const hasCc = msg.cc_addresses && msg.cc_addresses.length > 0;
  const hasBcc = msg.bcc_addresses && msg.bcc_addresses.length > 0;
  const hasAttachments = msg.attachments && msg.attachments.length > 0;

  return (
    <div className={cn(
      'rounded-xl border',
      isOutbound
        ? 'border-teal-200 dark:border-teal-500/30 bg-teal-50/50 dark:bg-teal-500/5'
        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50'
    )}>
      {/* Clip header only — a tall iframe must be able to grow the card */}
      <div className="overflow-hidden rounded-t-xl">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 lg:p-4 hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors"
      >
        <div className="flex items-center gap-2 lg:gap-3 min-w-0">
          <Avatar className="w-8 h-8 flex-shrink-0">
            <AvatarFallback className={cn(
              'text-xs font-medium',
              isOutbound
                ? 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400'
                : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
            )}>
              {getInitials(isOutbound ? 'You' : msg.from_name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                {isOutbound ? 'You' : (msg.from_name || msg.from_address || 'Unknown')}
              </span>
              {!isOutbound && msg.from_address && msg.from_name && (
                <span className="text-xs text-slate-400 truncate hidden sm:inline">
                  &lt;{msg.from_address}&gt;
                </span>
              )}
            </div>
            {!expanded && (
              <p className="text-xs text-slate-500 truncate max-w-[300px]">
                {msg.body_text?.slice(0, 100) || msg.body_html?.replace(/<[^>]*>/g, '').slice(0, 100)}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasAttachments && (
            <Paperclip className="w-3.5 h-3.5 text-slate-400" />
          )}
          <span className="text-xs text-slate-500" title={formatFullDate(msg.sent_at)}>
            {formatTime(msg.sent_at)}
          </span>
          {isOutbound && (
            msg.status === 'read' ? (
              <CheckCheck className="w-3.5 h-3.5 text-teal-500" />
            ) : msg.status === 'delivered' ? (
              <Check className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <Clock className="w-3.5 h-3.5 text-slate-400" />
            )
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>
      </div>

      {/* Message body - collapsible */}
      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-700/50">
          {/* To / CC / BCC line */}
          <div className="px-3 lg:px-4 pt-2 space-y-0.5">
            {msg.to_address && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="font-medium w-8">To:</span>
                <span>{msg.to_name ? `${msg.to_name} <${msg.to_address}>` : msg.to_address}</span>
              </div>
            )}
            {hasCc && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="font-medium w-8">CC:</span>
                <span>{msg.cc_addresses.map(r => r.name ? `${r.name} <${r.email}>` : r.email).join(', ')}</span>
              </div>
            )}
            {hasBcc && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="font-medium w-8">BCC:</span>
                <span>{msg.bcc_addresses.map(r => r.name ? `${r.name} <${r.email}>` : r.email).join(', ')}</span>
              </div>
            )}
          </div>

          {/* Meeting invite marker (messages sent with an iTIP part) */}
          {typeof msg.metadata?.calendar_event_id === 'string' && (
            <div className="px-3 lg:px-4 pt-3">
              <a
                href="/crm/calendar"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-teal-200 dark:border-teal-500/30 bg-teal-50 dark:bg-teal-500/10 text-xs font-medium text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-500/20 transition-colors"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                Meeting invitation — view in calendar
              </a>
            </div>
          )}

          {/* Email body */}
          <div className="px-3 lg:px-4 py-3">
            {hasHtml ? (
              <HtmlEmailBody html={msg.body_html!} />
            ) : (
              <p className="whitespace-pre-wrap break-words text-sm text-slate-900 dark:text-white">
                {msg.body_text || ''}
              </p>
            )}
          </div>

          {/* Attachments */}
          {hasAttachments && (
            <div className="px-3 lg:px-4 pb-3">
              <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-slate-500">
                <Paperclip className="w-3.5 h-3.5" />
                {msg.attachments.length} attachment{msg.attachments.length > 1 ? 's' : ''}
              </div>
              <div className="flex flex-wrap gap-2">
                {msg.attachments.map((att, i) => {
                  const sizeLabel = formatInboxFileSize(attachmentByteSize(att));
                  return (
                  <a
                    key={i}
                    href={att.url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      'inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors',
                      'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800',
                      'hover:bg-slate-100 dark:hover:bg-slate-700',
                      !att.url && 'opacity-50 pointer-events-none'
                    )}
                  >
                    <Paperclip className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="truncate max-w-[150px] text-slate-700 dark:text-slate-300">
                      {att.filename}
                    </span>
                    {sizeLabel && (
                    <span className="text-xs text-slate-400 flex-shrink-0">
                      {sizeLabel}
                    </span>
                    )}
                    {att.url && <Download className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}
                  </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const MessageThread = React.memo(function MessageThread({
  conversation,
  messages,
  loadingMessages,
  onStatusChange,
  onBackToList,
}: MessageThreadProps) {
  const [meetingOpen, setMeetingOpen] = useState(false);

  const meetingDefaults = useMemo(
    () => ({
      title: conversation.subject ? `Meeting: ${conversation.subject}` : undefined,
      attendees: participantsFromThread({
        conversation: {
          contact_email: conversation.contact_email,
          contact_name: conversation.contact_name,
        },
        messages: messages.map((msg) => ({
          direction: msg.direction,
          from_address: msg.from_address,
          from_name: msg.from_name,
          to_address: msg.to_address,
          cc_addresses: (msg.cc_addresses ?? []) as Array<{ email: string; name?: string }>,
        })),
        excludeEmails: [],
      }),
      recordId: conversation.contact_id ?? undefined,
      conversationId: conversation.id,
    }),
    [conversation, messages],
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Header */}
      <div className="p-3 lg:p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
          <div className="flex items-center gap-2 lg:gap-3 min-w-0 flex-1">
            <button
              onClick={onBackToList}
              className="lg:hidden p-2 -ml-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors shrink-0"
            >
              <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </button>
            <Avatar className="w-10 h-10 lg:w-12 lg:h-12 shrink-0">
              <AvatarFallback className={cn('text-xs lg:text-sm font-medium', CHANNEL_COLORS[conversation.channel])}>
                {getInitials(conversation.contact_name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-slate-900 dark:text-white truncate text-sm lg:text-base">
                {conversation.contact_name || 'Unknown Contact'}
              </h3>
              <p className="text-xs lg:text-sm text-slate-500 truncate whitespace-nowrap">
                {conversation.contact_email || conversation.contact_phone}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 lg:gap-2 shrink-0 w-full sm:w-auto sm:justify-end">
            <Select
              value={conversation.status}
              onValueChange={(value) => onStatusChange(conversation.id, value as ConversationStatus)}
            >
              <SelectTrigger className="w-24 lg:w-32 text-xs lg:text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            <button
              type="button"
              onClick={() => setMeetingOpen(true)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="Schedule meeting"
              aria-label="Schedule meeting"
            >
              <CalendarPlus className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                toast.info('More actions coming soon');
                e.currentTarget.blur();
              }}
              className="hidden sm:inline-flex p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="More actions"
              aria-label="More actions"
            >
              <MoreVertical className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Subject & Info */}
      <div className="px-3 lg:px-4 py-2 lg:py-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className={cn('p-1 lg:p-1.5 rounded flex-shrink-0', CHANNEL_COLORS[conversation.channel])}>
            {CHANNEL_ICONS[conversation.channel]}
          </span>
          <h2 className="font-medium text-slate-900 dark:text-white text-sm lg:text-base truncate">
            {conversation.subject || 'No subject'}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:gap-4 mt-1 lg:mt-2 text-xs lg:text-sm text-slate-500">
          <span className="flex items-center gap-1">
            <Clock className="w-3 lg:w-3.5 h-3 lg:h-3.5" />
            Started {formatTime(conversation.first_message_at)}
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-3 lg:w-3.5 h-3 lg:h-3.5" />
            {conversation.message_count} messages
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 p-3 lg:p-4 overflow-y-auto space-y-3">
        {loadingMessages ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No messages yet</p>
          </div>
        ) : (
          messages.map((msg) => (
            <EmailMessage key={msg.id} msg={msg} />
          ))
        )}
      </div>

      <MeetingComposer
        open={meetingOpen}
        onOpenChange={setMeetingOpen}
        defaults={meetingDefaults}
      />
    </div>
  );
});
