import { useState } from 'react';
import { Send, Loader, Lock, Mail } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';
import { toast } from '../ui/Toaster';

interface MessageComposerProps {
  ticketId: string;
  onMessageSent?: () => void;
  allowInternal?: boolean;
}

export function MessageComposer({ ticketId, onMessageSent, allowInternal = false }: MessageComposerProps) {
  const { profile } = useAuth();
  const [message, setMessage] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!message.trim()) return;

    setSending(true);
    setError(null);

    try {
      const { error: insertError } = await supabase
        .from('ticket_comments')
        .insert([
          {
            ticket_id: ticketId,
            author_id: profile?.id,
            body: message.trim(),
            is_internal: allowInternal ? isInternal : false,
          },
        ]);

      if (insertError) throw insertError;

      setMessage('');
      setIsInternal(false);

      if (onMessageSent) {
        onMessageSent();
      }

      toast({
        type: 'success',
        title: 'Message Sent',
        message: isInternal ? 'Internal note added' : 'Comment posted successfully',
      });
    } catch (err: any) {
      console.error('Error sending message:', err);
      setError(err.message || 'Failed to send message');
      toast({
        type: 'error',
        title: 'Failed to Send',
        message: err.message || 'Could not post comment',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message..."
          rows={4}
          className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
          disabled={sending}
        />
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-accent-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {!isInternal && allowInternal && message.trim() && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
          <Mail size={16} />
          <span>Email notification will be sent to the requester when you post this comment</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        {allowInternal && (
          <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300 cursor-pointer">
            <input
              type="checkbox"
              checked={isInternal}
              onChange={(e) => setIsInternal(e.target.checked)}
              className="rounded border-neutral-300 text-primary-800 focus:ring-primary-500"
              disabled={sending}
            />
            <Lock size={14} />
            <span>Internal note (visible to staff only)</span>
          </label>
        )}

        <button
          type="submit"
          disabled={!message.trim() || sending}
          className="ml-auto flex items-center gap-2 px-6 py-2 bg-primary-800 hover:bg-primary-900 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors"
        >
          {sending ? (
            <>
              <Loader size={18} className="animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send size={18} />
              Send Message
            </>
          )}
        </button>
      </div>
    </form>
  );
}
