'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, Button, Textarea, Label } from '@crm-eco/ui';
import { Loader2, Send } from 'lucide-react';
import { addMemberTicketComment } from '@/app/support/actions';

interface SupportTicketReplyFormProps {
  ticketId: string;
  disabled?: boolean;
}

export function SupportTicketReplyForm({ ticketId, disabled = false }: SupportTicketReplyFormProps) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setLoading(true);
    setError(null);

    const result = await addMemberTicketComment(ticketId, message.trim());

    if (!result.success) {
      setError(result.error ?? 'Failed to send message');
      setLoading(false);
      return;
    }

    setMessage('');
    setLoading(false);
    router.refresh();
  };

  if (disabled) {
    return (
      <Card className="border-slate-200 bg-slate-50">
        <CardContent className="py-6 text-center text-sm text-slate-600">
          This ticket is closed. Open a new ticket if you need further help.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Reply</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reply-message">Your message</Label>
            <Textarea
              id="reply-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your reply…"
              rows={4}
              disabled={loading}
              className="resize-none"
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={loading || !message.trim()} className="gap-2">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" aria-hidden />
                  Send reply
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

interface ThreadComment {
  id: string;
  body: string;
  created_at: string;
  author_name: string;
  is_member: boolean;
}

interface SupportTicketThreadProps {
  comments: ThreadComment[];
  ticketDescription: string;
  ticketCreatedAt: string;
}

export function SupportTicketThread({
  comments,
  ticketDescription,
  ticketCreatedAt,
}: SupportTicketThreadProps) {
  const hasComments = comments.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Conversation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-blue-50 p-4">
          <div className="mb-1 flex items-center justify-between gap-2 text-xs text-blue-700">
            <span className="font-medium">You · original message</span>
            <time dateTime={ticketCreatedAt}>
              {format(new Date(ticketCreatedAt), 'MMM d, yyyy h:mm a')}
            </time>
          </div>
          <p className="whitespace-pre-wrap text-sm text-blue-900">{ticketDescription}</p>
        </div>

        {comments.map((comment) => (
          <div
            key={comment.id}
            className={`rounded-lg p-4 ${
              comment.is_member ? 'bg-blue-50' : 'border border-slate-200 bg-white'
            }`}
          >
            <div className="mb-1 flex items-center justify-between gap-2 text-xs text-slate-500">
              <span className="font-medium">{comment.author_name}</span>
              <time dateTime={comment.created_at}>
                {format(new Date(comment.created_at), 'MMM d, yyyy h:mm a')}
              </time>
            </div>
            <p className="whitespace-pre-wrap text-sm text-slate-800">{comment.body}</p>
          </div>
        ))}

        {!hasComments && (
          <p className="text-center text-sm text-slate-500">
            No replies yet — our team typically responds within one business day.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
