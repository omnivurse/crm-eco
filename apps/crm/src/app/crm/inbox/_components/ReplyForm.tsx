'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase-client';
import { Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { InboxConversation } from '@/lib/inbox/types';

interface ReplyFormProps {
  selectedConversation: InboxConversation;
  authProfile: { id: string; organization_id: string; full_name: string | null };
  authUserEmail: string;
  onReplySent: (conversationId: string) => void;
}

export function ReplyForm({ selectedConversation, authProfile, authUserEmail, onReplySent }: ReplyFormProps) {
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const handleSendReply = async () => {
    if (!replyText.trim()) return;

    setSending(true);
    try {
      const { error } = await supabase.from('inbox_messages').insert({
        org_id: authProfile.organization_id,
        conversation_id: selectedConversation.id,
        channel: selectedConversation.channel,
        direction: 'outbound',
        from_name: authProfile.full_name || authUserEmail,
        from_address: authUserEmail,
        to_address: selectedConversation.contact_email || selectedConversation.contact_phone,
        to_name: selectedConversation.contact_name,
        body_text: replyText,
        status: 'sent',
        sent_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast.success('Reply sent');
      setReplyText('');
      onReplySent(selectedConversation.id);
    } catch (error) {
      console.error('Failed to send reply:', error);
      toast.error('Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-3 lg:p-4 border-t border-slate-200 dark:border-slate-700">
      <div className="flex gap-2 lg:gap-3">
        <textarea
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder="Type your reply..."
          rows={2}
          className="flex-1 px-3 lg:px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm lg:text-base text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
        />
        <button
          onClick={handleSendReply}
          disabled={!replyText.trim() || sending}
          className="px-3 lg:px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors self-end"
        >
          {sending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
}
