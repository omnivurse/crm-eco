'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Label, Textarea } from '@crm-eco/ui';
import { addAdminTicketComment } from '../actions';

export function AdminTicketReplyForm({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await addAdminTicketComment({
        ticketId,
        body,
        isInternal,
      });
      if (!result.success) {
        setError(result.error ?? 'Failed to send');
        return;
      }
      setBody('');
      setIsInternal(false);
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3 border-t border-slate-100 pt-4 dark:border-white/10">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="admin-ticket-reply">Reply</Label>
        <Textarea
          id="admin-ticket-reply"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder="Write a reply to the member…"
          disabled={pending}
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={isInternal}
          onChange={(e) => setIsInternal(e.target.checked)}
          disabled={pending}
        />
        Internal note (hidden from member)
      </label>
      <Button type="submit" disabled={pending || !body.trim()} className="bg-primary">
        {pending ? 'Sending…' : isInternal ? 'Add internal note' : 'Send reply'}
      </Button>
    </form>
  );
}
