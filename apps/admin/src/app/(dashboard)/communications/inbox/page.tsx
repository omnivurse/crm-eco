'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, EnvelopeSimple, PaperPlaneTilt, Spinner } from '@phosphor-icons/react';
import { Button } from '@crm-eco/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui/components/card';
import { cn } from '@crm-eco/ui/lib/utils';

interface InboxConversation {
  id: string;
  subject: string | null;
  from_email: string | null;
  from_name: string | null;
  preview: string | null;
  status: string;
  unread_count: number;
  last_message_at: string | null;
  channel: string;
}

interface InboxMessage {
  id: string;
  direction: string;
  from_address: string | null;
  to_address: string | null;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  created_at: string;
}

export default function AdminInboxPage() {
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<InboxConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/inbox?status=active&limit=100');
      const data = await res.json();
      if (res.ok) {
        setConversations(data.conversations || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    setLoadingMessages(true);
    setSelectedId(id);
    try {
      const res = await fetch(`/api/inbox/${id}`);
      const data = await res.json();
      if (res.ok) {
        setSelectedConversation(data.conversation);
        setMessages(data.messages || []);
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c))
        );
      }
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Inbox</h1>
          <p className="text-sm text-slate-500">
            Incoming mail to @payitforwardhealth.com (support, billing, contact, etc.)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadConversations}>
            Refresh
          </Button>
          <Button asChild size="sm">
            <Link href="/communications/compose">
              <PaperPlaneTilt className="mr-2 h-4 w-4" />
              Compose
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr] min-h-[560px]">
        <Card className="overflow-hidden">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">Conversations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-slate-400">
                <Spinner className="h-5 w-5 animate-spin" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-slate-500">
                <EnvelopeSimple className="mx-auto mb-2 h-8 w-8 opacity-50" />
                No conversations yet
              </div>
            ) : (
              <ul className="divide-y max-h-[520px] overflow-y-auto">
                {conversations.map((conv) => (
                  <li key={conv.id}>
                    <button
                      type="button"
                      onClick={() => loadConversation(conv.id)}
                      className={cn(
                        'w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors',
                        selectedId === conv.id && 'bg-slate-100'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className={cn('text-sm truncate', conv.unread_count > 0 && 'font-semibold')}>
                          {conv.from_name || conv.from_email || 'Unknown'}
                        </span>
                        {conv.unread_count > 0 && (
                          <span className="shrink-0 rounded-full bg-teal-600 px-1.5 py-0.5 text-[10px] text-white">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 truncate mt-0.5">{conv.subject || '(No subject)'}</p>
                      <p className="text-xs text-slate-400 truncate mt-1">{conv.preview}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          {!selectedId ? (
            <CardContent className="flex h-full min-h-[520px] items-center justify-center text-sm text-slate-500">
              Select a conversation
            </CardContent>
          ) : loadingMessages ? (
            <CardContent className="flex h-full min-h-[520px] items-center justify-center">
              <Spinner className="h-5 w-5 animate-spin text-slate-400" />
            </CardContent>
          ) : (
            <>
              <CardHeader className="border-b py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{selectedConversation?.subject || '(No subject)'}</CardTitle>
                    <p className="text-sm text-slate-500 mt-1">
                      From {selectedConversation?.from_name || selectedConversation?.from_email}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      href={`/communications/compose?to=${encodeURIComponent(selectedConversation?.from_email || '')}&subject=${encodeURIComponent(`Re: ${selectedConversation?.subject || ''}`)}`}
                    >
                      Reply
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-4 max-h-[460px] overflow-y-auto">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      'rounded-lg border p-3 text-sm',
                      msg.direction === 'outbound' ? 'ml-8 bg-teal-50 border-teal-100' : 'mr-8 bg-white'
                    )}
                  >
                    <div className="flex justify-between gap-2 text-xs text-slate-500 mb-2">
                      <span>{msg.from_address}</span>
                      <span>{new Date(msg.created_at).toLocaleString()}</span>
                    </div>
                    <div className="whitespace-pre-wrap text-slate-800">
                      {msg.body_text || '(HTML only)'}
                    </div>
                  </div>
                ))}
              </CardContent>
            </>
          )}
        </Card>
      </div>

      <p className="text-xs text-slate-400">
        Full CRM inbox with assignment and templates:{' '}
        <a href="https://crm.payitforwardhealth.com/crm/inbox" className="underline" target="_blank" rel="noreferrer">
          Open CRM Inbox
        </a>
      </p>
    </div>
  );
}
