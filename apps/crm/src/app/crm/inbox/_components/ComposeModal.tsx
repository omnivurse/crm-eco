'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase-client';
import { Send, Loader2, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import type { ConversationStatus, ConversationPriority } from '@/lib/inbox/types';

interface ComposeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  authProfile: { id: string; organization_id: string; full_name: string | null };
  authUserEmail: string;
  onMessageSent: () => void;
}

export function ComposeModal({ open, onOpenChange, authProfile, authUserEmail, onMessageSent }: ComposeModalProps) {
  const [composeChannel, setComposeChannel] = useState<'email' | 'sms' | 'whatsapp'>('email');
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeMessage, setComposeMessage] = useState('');
  const [composeSending, setComposeSending] = useState(false);

  const resetForm = () => {
    setComposeChannel('email');
    setComposeTo('');
    setComposeSubject('');
    setComposeMessage('');
  };

  const handleSend = async () => {
    if (!composeTo.trim() || !composeMessage.trim()) {
      toast.error('To and Message are required');
      return;
    }
    if (composeChannel === 'email' && !composeSubject.trim()) {
      toast.error('Subject is required for email');
      return;
    }

    setComposeSending(true);
    try {
      const payload: Record<string, string | undefined> = {
        channel: composeChannel,
        to: composeTo.trim(),
        from_name: authProfile.full_name || authUserEmail || undefined,
      };

      if (composeChannel === 'email') {
        payload.subject = composeSubject.trim();
        payload.body_text = composeMessage.trim();
      } else {
        payload.body = composeMessage.trim();
      }

      const res = await fetch('/api/communications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      // Create inbox conversation + message records
      const now = new Date().toISOString();
      const { data: conv, error: convError } = await supabase
        .from('inbox_conversations')
        .insert({
          org_id: authProfile.organization_id,
          channel: composeChannel,
          thread_id: data.message_id || crypto.randomUUID(),
          subject: composeSubject.trim() || null,
          preview: composeMessage.trim().slice(0, 200),
          contact_email: composeChannel === 'email' ? composeTo.trim() : null,
          contact_phone: composeChannel !== 'email' ? composeTo.trim() : null,
          contact_name: null,
          status: 'open' as ConversationStatus,
          priority: 'normal' as ConversationPriority,
          assigned_to: authProfile.id,
          assigned_at: now,
          unread_count: 0,
          message_count: 1,
          last_message_at: now,
          first_message_at: now,
          tags: [],
          labels: [],
          metadata: {},
        })
        .select()
        .single();

      if (convError) {
        console.error('Failed to create conversation record:', convError);
      } else if (conv) {
        await supabase.from('inbox_messages').insert({
          org_id: authProfile.organization_id,
          conversation_id: conv.id,
          channel: composeChannel,
          direction: 'outbound',
          from_name: authProfile.full_name || authUserEmail,
          from_address: authUserEmail,
          to_address: composeTo.trim(),
          subject: composeSubject.trim() || null,
          body_text: composeMessage.trim(),
          status: 'sent',
          sent_at: now,
          external_id: data.message_id || null,
          external_provider: data.provider || null,
          metadata: {},
        });
      }

      toast.success('Message sent');
      onOpenChange(false);
      resetForm();
      onMessageSent();
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send message');
    } finally {
      setComposeSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetForm(); }}>
      <DialogContent className="w-[95vw] max-w-xl mx-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">New Conversation</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 lg:space-y-4 pt-3 lg:pt-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Channel</label>
            <Select value={composeChannel} onValueChange={(v) => setComposeChannel(v as 'email' | 'sms' | 'whatsapp')}>
              <SelectTrigger className="text-sm lg:text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">To</label>
            <input
              type="text"
              value={composeTo}
              onChange={(e) => setComposeTo(e.target.value)}
              placeholder="Search contacts or enter email/phone"
              className="w-full px-3 lg:px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm lg:text-base text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Subject</label>
            <input
              type="text"
              value={composeSubject}
              onChange={(e) => setComposeSubject(e.target.value)}
              placeholder="Enter subject"
              className="w-full px-3 lg:px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm lg:text-base text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Message</label>
            <textarea
              rows={4}
              value={composeMessage}
              onChange={(e) => setComposeMessage(e.target.value)}
              placeholder="Type your message..."
              className="w-full px-3 lg:px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm lg:text-base text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="flex items-center justify-between pt-3 lg:pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={() => toast.info('File attachments coming soon')}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="Attach file"
            >
              <Paperclip className="w-5 h-5 text-slate-400" />
            </button>
            <div className="flex gap-2 lg:gap-3">
              <button
                onClick={() => onOpenChange(false)}
                className="px-3 lg:px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={composeSending || !composeTo.trim() || !composeMessage.trim()}
                className="inline-flex items-center gap-2 px-3 lg:px-4 py-2 text-sm bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {composeSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">{composeSending ? 'Sending...' : 'Send'}</span>
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
