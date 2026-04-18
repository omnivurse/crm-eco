'use client';

/**
 * SendEmailDialog — record-scoped email composer launched from the V2 detail
 * header. Wraps the existing `EmailComposer` so users get attachments,
 * signatures and draft-saving without us reinventing the composer.
 *
 * Behaviour:
 *   1. Pre-fills `To` with `record.email` (and the record title as display name).
 *   2. Pre-fills `Subject` with "Re: <record title>" unless the caller overrides.
 *   3. On send:
 *        - POST /api/communications/send     → actually dispatches via Resend/etc.
 *        - POST /api/crm/tasks               → logs a completed `email` activity
 *                                               for this record so it shows up
 *                                               in insights / timeline.
 *   4. `onSent` fires after both finish; the V2 shell uses it to refresh
 *      insights + navigate to the Emails pane.
 *
 * This is intentionally lighter than the inbox ComposeModal — no inbox
 * conversation is created because record-scoped sends shouldn't litter the
 * shared inbox. The email shows up in the record timeline only.
 */

import { useCallback, useMemo, useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';
import { toast } from 'sonner';
import {
  EmailComposer,
  type EmailComposerData,
} from '@/components/email/EmailComposer';
import { useClientAuth } from '@/hooks/useClientAuth';
import type { CrmRecord } from '@/lib/crm/types';

export interface SendEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: Pick<CrmRecord, 'id' | 'email' | 'title'>;
  /** Optional override for the prefilled subject. */
  initialSubject?: string;
  /** Optional override for the prefilled body. */
  initialBody?: string;
  /** Fired after the email dispatches + the activity logs. */
  onSent?: () => void;
}

export function SendEmailDialog({
  open,
  onOpenChange,
  record,
  initialSubject,
  initialBody,
  onSent,
}: SendEmailDialogProps) {
  const { user, profile, loading } = useClientAuth();
  const [_isSending, setIsSending] = useState(false);

  const initialTo = useMemo(
    () =>
      record.email
        ? [{ email: record.email, name: record.title ?? undefined }]
        : [],
    [record.email, record.title],
  );

  const computedSubject = useMemo(
    () => initialSubject ?? (record.title ? `Re: ${record.title}` : ''),
    [initialSubject, record.title],
  );

  // Reset sending flag when the dialog closes so a reopen isn't stuck.
  useEffect(() => {
    if (!open) setIsSending(false);
  }, [open]);

  const handleSend = useCallback(
    async (data: EmailComposerData) => {
      if (!record.email && data.to.length === 0) {
        throw new Error('Add at least one recipient.');
      }

      setIsSending(true);
      try {
        // 1. Dispatch the email through the existing comms pipeline.
        const sendRes = await fetch('/api/communications/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: 'email',
            to: data.to.map((r) => r.email),
            cc: data.cc.map((r) => r.email),
            bcc: data.bcc.map((r) => r.email),
            subject: data.subject,
            body_html: data.body_html,
            body_text: data.body_text,
            from_name: profile?.full_name || user?.email,
          }),
        });
        const sendBody = (await sendRes.json().catch(() => ({}))) as {
          error?: string;
        };
        if (!sendRes.ok) {
          throw new Error(sendBody.error || 'Failed to send email');
        }

        // 2. Log the send as a completed email activity on the record. This
        //    is best-effort — if it fails the user already sent the email,
        //    so we surface a warning rather than an error.
        try {
          const now = new Date().toISOString();
          const taskRes = await fetch('/api/crm/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              record_id: record.id,
              title: data.subject || 'Email sent',
              description: data.body_text || null,
              activity_type: 'email',
              status: 'completed',
              priority: 'medium',
              completed_at: now,
              outcome: `Sent to ${data.to.map((r) => r.email).join(', ')}`,
            }),
          });
          if (!taskRes.ok) {
            console.warn(
              '[SendEmailDialog] activity log failed:',
              await taskRes.text(),
            );
          }
        } catch (logErr) {
          console.warn('[SendEmailDialog] activity log error:', logErr);
        }

        toast.success('Email sent');
        onOpenChange(false);
        onSent?.();
      } finally {
        setIsSending(false);
      }
    },
    [record.id, record.email, profile?.full_name, user?.email, onOpenChange, onSent],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto p-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
        <DialogHeader className="px-5 pt-5 pb-2">
          <DialogTitle className="text-lg font-semibold">
            Email {record.title ? `— ${record.title}` : ''}
          </DialogTitle>
        </DialogHeader>
        <div className="px-5 pb-5">
          {loading ? (
            <div className="py-10 text-center text-sm text-slate-500">
              Loading composer…
            </div>
          ) : !user ? (
            <div className="py-10 text-center text-sm text-rose-600">
              You must be signed in to send email.
            </div>
          ) : (
            <EmailComposer
              initialTo={initialTo}
              initialSubject={computedSubject}
              initialBody={initialBody}
              onSend={handleSend}
              onCancel={() => onOpenChange(false)}
              showAttachments={true}
              showSignatures={true}
              showSchedule={false}
              showSave={false}
              fallbackEmail={user.email || ''}
              fallbackName={profile?.full_name || undefined}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
