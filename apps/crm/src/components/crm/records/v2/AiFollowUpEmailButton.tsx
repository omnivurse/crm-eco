'use client';

/**
 * "Generate AI follow-up email" CTA — lives in the Insights panel `extras`
 * slot. Calls `/api/crm/ai/email-draft`, then asks the parent to open
 * `SendEmailDialog` pre-filled with the returned subject + body.
 */

import { memo, useCallback, useState } from 'react';
import { Loader2, Sparkles, Mail } from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import { toast } from 'sonner';

export interface AiFollowUpEmailDraft {
  subject: string;
  body: string;
}

export interface AiFollowUpEmailButtonProps {
  recordId: string;
  /** True if the record has an email recipient. */
  hasRecipient: boolean;
  onDraft: (draft: AiFollowUpEmailDraft) => void;
  className?: string;
}

export const AiFollowUpEmailButton = memo(function AiFollowUpEmailButton({
  recordId,
  hasRecipient,
  onDraft,
  className,
}: AiFollowUpEmailButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(async () => {
    if (loading) return;
    if (!hasRecipient) {
      toast.warning('No email on file', {
        description: 'Add an email address before drafting a follow-up.',
      });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/crm/ai/email-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ recordId, tone: 'friendly' }),
      });
      if (!res.ok) {
        let code: string | undefined;
        let message = `AI request failed (${res.status})`;
        try {
          const body = await res.json();
          if (body?.error) message = body.error as string;
          if (body?.code) code = body.code as string;
        } catch {
          /* ignore */
        }
        if (code === 'AI_NOT_CONFIGURED') {
          toast.warning('AI assistant not configured', {
            description: 'Set OPENAI_API_KEY on the server to enable drafts.',
          });
        } else {
          toast.error(message);
        }
        return;
      }
      const body = (await res.json()) as { subject?: string; body?: string };
      onDraft({
        subject: (body.subject ?? '').trim(),
        body: (body.body ?? '').trim(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error('AI request failed', { description: message });
    } finally {
      setLoading(false);
    }
  }, [hasRecipient, loading, onDraft, recordId]);

  return (
    <section
      className={cn(
        'rounded-xl border border-violet-200 dark:border-violet-500/20 bg-gradient-to-br from-violet-50/80 to-white dark:from-violet-500/10 dark:to-slate-900/40 p-4 flex flex-col gap-2',
        className,
      )}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
        <Sparkles className="w-3.5 h-3.5" />
        Next best action
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
        Let the assistant draft a follow-up email grounded in this record&apos;s
        recent notes and activity.
      </p>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium',
          'bg-violet-600 text-white hover:bg-violet-700',
          'shadow-sm disabled:opacity-70 disabled:cursor-not-allowed transition-colors',
        )}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Mail className="w-4 h-4" />
        )}
        {loading ? 'Drafting…' : 'Generate AI follow-up email'}
      </button>
    </section>
  );
});
