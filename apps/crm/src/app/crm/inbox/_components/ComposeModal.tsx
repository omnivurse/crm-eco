'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FileText } from 'lucide-react';
import { toast } from 'sonner';
import { toastCopy } from '@/lib/crm/toast-copy';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';
import { EmailComposer, type EmailComposerData } from '@/components/email/EmailComposer';
import type { EmailAttachment } from '@/components/email/EmailAttachments';
import { TemplatePicker } from './TemplatePicker';
import { composerDataToCommunicationsSendBody } from '@/lib/email/outbound-attachments';

interface EmailRecipient {
  email: string;
  name?: string;
}

interface ComposeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  authProfile: { id: string; organization_id: string; full_name: string | null };
  authUserEmail: string;
  onMessageSent: () => void;
  initialTo?: EmailRecipient[];
  initialSubject?: string;
  initialBody?: string;
  /** Pre-loaded files (e.g. a forwarded message's stored attachments). */
  initialAttachments?: EmailAttachment[];
  /** Bump on every open so EmailComposer remounts instead of keeping the last To/subject. */
  composerKey: string;
  /** Resume a saved draft (updates this row on save). */
  initialDraftId?: string | null;
}

export function ComposeModal({
  open,
  onOpenChange,
  authProfile,
  authUserEmail,
  onMessageSent,
  initialTo,
  initialSubject,
  initialBody,
  initialAttachments,
  composerKey,
  initialDraftId,
}: ComposeModalProps) {
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [templateSubject, setTemplateSubject] = useState<string | undefined>(undefined);
  const [templateBody, setTemplateBody] = useState<string | undefined>(undefined);
  const draftIdRef = useRef<string | null>(initialDraftId ?? null);

  useEffect(() => {
    draftIdRef.current = initialDraftId ?? null;
  }, [composerKey, initialDraftId]);

  const handleSend = useCallback(async (data: EmailComposerData) => {
    if (data.to.length === 0) {
      throw new Error('At least one recipient is required');
    }

    const fromEmail = data.from_email || 'noreply@payitforwardhealth.com';
    const fromName = data.from_name || 'Pay It Forward Health';
    const replyTo = fromEmail.startsWith('noreply@')
      ? 'support@payitforwardhealth.com'
      : fromEmail;

    // Send via Resend through the communications API
    const res = await fetch('/api/communications/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...composerDataToCommunicationsSendBody({
          ...data,
          from_email: fromEmail,
          from_name: fromName,
          reply_to: replyTo,
        }),
        persist_inbox: true,
        to_name: data.to[0].name,
      }),
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to send email');

    if (!result.inbox_conversation_id) {
      toast.error(
        toastCopy.failed(
          'save this email to the inbox',
          'it was sent, but the conversation was not created',
        ),
      );
    }

    // Delete draft if we had one saved
    if (draftIdRef.current) {
      await fetch(`/api/inbox/drafts/${draftIdRef.current}`, { method: 'DELETE' });
      draftIdRef.current = null;
    }

    onOpenChange(false);
    onMessageSent();
  }, [authProfile, authUserEmail, onOpenChange, onMessageSent]);

  const handleSave = useCallback(async (data: EmailComposerData) => {
    const payload = {
      to_addresses: data.to,
      cc_addresses: data.cc,
      bcc_addresses: data.bcc,
      subject: data.subject,
      body_html: data.body_html,
      body_text: data.body_text,
      signature_id: data.signature_id || null,
      attachments: data.attachments.map(a => ({
        filename: a.file_name,
        content_type: a.mime_type,
        size: a.file_size,
        url: a.public_url || null,
        file_path: a.file_path || a.bucket_path || null,
      })),
    };

    if (draftIdRef.current) {
      // Update existing draft
      await fetch(`/api/inbox/drafts/${draftIdRef.current}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      // Create new draft
      const res = await fetch('/api/inbox/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (result.draft?.id) {
        draftIdRef.current = result.draft.id;
      }
    }
  }, []);

  const handleSchedule = useCallback(async (data: EmailComposerData, scheduledAt: Date) => {
    if (data.to.length === 0) {
      throw new Error('At least one recipient is required');
    }

    const payload = {
      to_addresses: data.to,
      cc_addresses: data.cc,
      bcc_addresses: data.bcc,
      subject: data.subject,
      body_html: data.body_html,
      body_text: data.body_text,
      signature_id: data.signature_id || null,
      attachments: data.attachments.map(a => ({
        filename: a.file_name,
        content_type: a.mime_type,
        size: a.file_size,
        url: a.public_url || null,
        file_path: a.file_path || a.bucket_path || null,
      })),
      scheduled_at: scheduledAt.toISOString(),
    };

    if (draftIdRef.current) {
      const res = await fetch(`/api/inbox/drafts/${draftIdRef.current}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const result = await res.json().catch(() => ({}));
        // Throw so EmailComposer shows the failure — closing with a success
        // toast while nothing is scheduled silently drops the email.
        throw new Error(result.error || 'Failed to schedule email');
      }
    } else {
      const res = await fetch('/api/inbox/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.draft?.id) {
        throw new Error(result.error || 'Failed to schedule email');
      }
    }

    draftIdRef.current = null;
    onOpenChange(false);
  }, [onOpenChange]);

  const handleTemplateSelect = useCallback((template: { subject: string; body_html: string }) => {
    setTemplateSubject(template.subject);
    setTemplateBody(template.body_html);
    toast.success(toastCopy.applied('Template'));
  }, []);

  // Reset state when dialog closes
  const handleOpenChange = useCallback((o: boolean) => {
    if (!o) {
      draftIdRef.current = null;
      setTemplateSubject(undefined);
      setTemplateBody(undefined);
    }
    onOpenChange(o);
  }, [onOpenChange]);

  // Compute effective initial values (template overrides if set)
  const effectiveSubject = templateSubject ?? initialSubject;
  const effectiveBody = templateBody ?? initialBody;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="w-[98vw] max-w-[900px] sm:max-w-[900px] mx-auto max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-6 pb-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg">
                {initialSubject?.startsWith('Fwd:') ? 'Forward Email' : 'New Email'}
              </DialogTitle>
              <button
                onClick={() => setShowTemplatePicker(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                Templates
              </button>
            </div>
          </DialogHeader>
          <div className="px-2 pb-2">
            <EmailComposer
              key={composerKey}
              initialTo={initialTo}
              initialSubject={effectiveSubject}
              initialBody={effectiveBody}
              initialAttachments={initialAttachments}
              onSend={handleSend}
              onSave={handleSave}
              onSchedule={handleSchedule}
              onCancel={() => handleOpenChange(false)}
              showSchedule={true}
              showSave={true}
              showAttachments={true}
              showSignatures={true}
              fallbackEmail="noreply@payitforwardhealth.com"
              fallbackName="Pay It Forward Health"
              className="border-0 shadow-none"
            />
          </div>
        </DialogContent>
      </Dialog>

      <TemplatePicker
        open={showTemplatePicker}
        onClose={() => setShowTemplatePicker(false)}
        onSelect={handleTemplateSelect}
      />
    </>
  );
}
