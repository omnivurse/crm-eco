'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, StickyNote, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@crm-eco/ui/components/sheet';
import { participantsFromThread } from '@/lib/calendar/thread-participants';
import { toastCopy } from '@/lib/crm/toast-copy';
import {
  INBOX_CONTACT_CATEGORIES,
  emailConversationNotePrefix,
  inferPartnerIndustry,
  proposeContactFromParticipant,
  type ExtractedInboxContact,
} from '@/lib/inbox/extract-contact-from-email';
import {
  conversationNotePrefixForThread,
  latestInboundSentAt,
} from '@/lib/inbox/inbox-contact-from-thread';
import type { InboxConversation, InboxMessage } from '@/lib/inbox/types';

export type InboxContactSheetMode = 'create' | 'note';

export interface InboxContactLinkedPatch {
  contact_id: string;
  contact_email?: string | null;
  contact_name?: string | null;
}

interface DuplicateHit {
  id: string;
  title?: string | null;
  email?: string | null;
}

interface CreateContactFromEmailSheetProps {
  open: boolean;
  mode: InboxContactSheetMode;
  conversation: InboxConversation;
  messages: InboxMessage[];
  onOpenChange: (open: boolean) => void;
  onLinked?: (patch: InboxContactLinkedPatch) => void;
}

const PARTNER_TYPES = ['Partner', 'Referring Partner', 'Agency', 'Vendor', 'Other'] as const;
const PARTNER_INDUSTRIES = [
  'Banking / Credit Union',
  'Mortgage / Lending',
  'Insurance - Property & Casualty',
  'Financial Advisor / Wealth Management',
  'CPA / Accounting / Bookkeeping',
  'Attorney / Legal',
  'Employer / Business Owner',
  'Other',
] as const;

const fieldClass =
  'h-9 text-sm bg-white dark:bg-slate-900/50 border-slate-200 dark:border-white/10';

function emptyFields(): ExtractedInboxContact {
  return {
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    title: '',
    company: '',
    website: '',
  };
}

export function CreateContactFromEmailSheet({
  open,
  mode,
  conversation,
  messages,
  onOpenChange,
  onLinked,
}: CreateContactFromEmailSheetProps) {
  const participants = useMemo(
    () =>
      participantsFromThread({
        conversation: {
          contact_email: conversation.contact_email,
          contact_name: conversation.contact_name,
        },
        messages: messages.map((msg) => ({
          direction: msg.direction,
          from_address: msg.from_address,
          from_name: msg.from_name,
          to_address: msg.to_address,
          cc_addresses: msg.cc_addresses ?? [],
        })),
        excludeEmails: conversation.mailbox_address ? [conversation.mailbox_address] : [],
      }),
    [conversation, messages],
  );

  const defaultEmail = useMemo(() => {
    if (mode === 'note' && conversation.contact_email) {
      const linked = conversation.contact_email.trim().toLowerCase();
      if (participants.some((p) => p.email === linked)) return linked;
    }
    return participants[0]?.email ?? '';
  }, [mode, conversation.contact_email, participants]);

  const [email, setEmail] = useState(defaultEmail);
  const [fields, setFields] = useState<ExtractedInboxContact>(emptyFields);
  const [category, setCategory] = useState('Partner Contact');
  const [relationshipType, setRelationshipType] = useState('Partner');
  const [industry, setIndustry] = useState('');
  const [note, setNote] = useState('');
  const [existing, setExisting] = useState<DuplicateHit[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = participants.find((p) => p.email === email) ?? participants[0];
  const isExisting = (existing?.length ?? 0) > 0;
  const existingId = existing?.[0]?.id ?? (mode === 'note' ? conversation.contact_id : null);
  const noteOnly = isExisting || (mode === 'note' && !!existingId);

  useEffect(() => {
    if (!open) return;
    const nextEmail = defaultEmail;
    setEmail(nextEmail);
    setCategory('Partner Contact');
    setRelationshipType('Partner');
    setError(null);
    const prefix = conversationNotePrefixForThread({
      subject: conversation.subject,
      sentAt: latestInboundSentAt(messages),
    });
    setNote(`${prefix}\n`);
    const person = participants.find((p) => p.email === nextEmail);
    if (person) {
      const next = proposeContactFromParticipant({ participant: person, messages });
      setFields(next);
      setIndustry(inferPartnerIndustry(next.company, next.email));
    } else {
      setFields(emptyFields());
      setIndustry('');
    }
  }, [open, defaultEmail, conversation.subject, messages, participants]);

  useEffect(() => {
    if (!open || !email) {
      setExisting(null);
      return;
    }
    let cancelled = false;
    setChecking(true);
    const t = window.setTimeout(async () => {
      try {
        const qs = new URLSearchParams({ module_key: 'contacts', email });
        const res = await fetch(`/api/crm/records/check-duplicate?${qs}`);
        const json = (await res.json()) as { duplicates?: DuplicateHit[] };
        if (!cancelled) setExisting(Array.isArray(json.duplicates) ? json.duplicates : []);
      } catch {
        if (!cancelled) setExisting([]);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [open, email]);

  const setField = (key: keyof ExtractedInboxContact, value: string) => {
    setFields((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'company' || key === 'email') {
        setIndustry(inferPartnerIndustry(next.company, next.email || email));
      }
      return next;
    });
  };

  const pickPerson = (next: string) => {
    setEmail(next);
    const person = participants.find((p) => p.email === next);
    if (person) {
      const next = proposeContactFromParticipant({ participant: person, messages });
      setFields(next);
      setIndustry(inferPartnerIndustry(next.company, next.email));
    }
  };

  const applyLink = (recordId: string) => {
    onLinked?.({
      contact_id: recordId,
      contact_email: fields.email || email,
      contact_name: `${fields.first_name} ${fields.last_name}`.trim() || selected?.name || null,
    });
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      if (noteOnly) {
        const target = existingId;
        const res = await fetch(`/api/inbox/${conversation.id}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            body: note,
            email,
            record_id: conversation.contact_id && !email ? conversation.contact_id : target,
          }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          error?: string;
          record_id?: string;
          linked?: boolean;
        };
        if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : 'Could not save the note');
        const copy = toastCopy.addedWithAction('Note', { actionLabel: 'View contact' });
        const recordId = json.record_id ?? target;
        toast.success(copy.title, {
          action: recordId
            ? { label: copy.actionLabel, onClick: () => window.open(`/crm/r/${recordId}`, '_self') }
            : undefined,
        });
        if (json.linked && recordId) applyLink(recordId);
        onOpenChange(false);
        return;
      }

      const res = await fetch(`/api/inbox/${conversation.id}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          first_name: fields.first_name,
          last_name: fields.last_name,
          phone: fields.phone,
          title: fields.title,
          company: fields.company,
          website: fields.website,
          contact_category: category,
          relationship_type: relationshipType,
          partner_industry: industry,
          note,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        duplicates?: DuplicateHit[];
        record?: { id: string };
        linked?: boolean;
      };
      if (res.status === 409 && json.duplicates?.length) {
        setExisting(json.duplicates);
        return;
      }
      if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : 'Could not create the contact');
      const copy = toastCopy.addedWithAction('Contact', { actionLabel: 'View contact' });
      toast.success(copy.title, {
        action: json.record?.id
          ? { label: copy.actionLabel, onClick: () => window.open(`/crm/r/${json.record!.id}`, '_self') }
          : undefined,
      });
      if (json.record?.id && (json.linked || !conversation.contact_id)) applyLink(json.record.id);
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
      toast.error(toastCopy.failed(noteOnly ? 'save the note' : 'create the contact', err, 'Try again'));
    } finally {
      setSubmitting(false);
    }
  };

  const linkExisting = async () => {
    if (!existingId || conversation.contact_id) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/inbox/${conversation.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'link_record', contact_id: existingId }),
      });
      if (!res.ok) throw new Error('Could not link this thread');
      applyLink(existingId);
      toast.success(toastCopy.saved('Thread'));
    } catch (err) {
      toast.error(toastCopy.failed('link this thread', err, 'Try again'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md overflow-y-auto"
        data-testid="crm-inbox-contact-sheet"
      >
        <SheetHeader>
          <SheetTitle>{noteOnly ? 'Log this conversation' : 'Add contact from email'}</SheetTitle>
          <SheetDescription>
            {noteOnly
              ? 'The note is saved on their contact record — the same Notes tab you already use.'
              : 'We fill what we can from their name and signature. You can edit anything before saving.'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-4">
          {participants.length > 1 && (
            <div className="space-y-1.5">
              <Label htmlFor="inbox-contact-person">Person on this email</Label>
              <select
                id="inbox-contact-person"
                className={`${fieldClass} w-full rounded-md border px-3`}
                value={email}
                onChange={(e) => pickPerson(e.target.value)}
              >
                {participants.map((p) => (
                  <option key={p.email} value={p.email}>
                    {p.name ? `${p.name} · ${p.email}` : p.email}
                  </option>
                ))}
              </select>
            </div>
          )}

          {participants.length === 1 && (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {selected?.name || fields.first_name}{' '}
              <span className="text-slate-400">{email}</span>
            </p>
          )}

          {checking && (
            <p className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Checking for an existing contact…
            </p>
          )}

          {isExisting && existingId && (
            <div className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-100">
              <p>
                Already a contact{existing?.[0]?.title ? ` — ${existing[0].title}` : ''}. Add a note
                for this conversation instead of creating another record.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline" className="h-8">
                  <Link href={`/crm/r/${existingId}`}>Open contact</Link>
                </Button>
                {!conversation.contact_id && (
                  <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => void linkExisting()}>
                    Link this thread
                  </Button>
                )}
              </div>
            </div>
          )}

          {!noteOnly && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="inbox-contact-first">First name</Label>
                <Input
                  id="inbox-contact-first"
                  className={fieldClass}
                  value={fields.first_name}
                  onChange={(e) => setField('first_name', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inbox-contact-last">Last name</Label>
                <Input
                  id="inbox-contact-last"
                  className={fieldClass}
                  value={fields.last_name}
                  onChange={(e) => setField('last_name', e.target.value)}
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="inbox-contact-email">Email</Label>
                <Input id="inbox-contact-email" className={fieldClass} value={email} readOnly />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inbox-contact-phone">Phone</Label>
                <Input
                  id="inbox-contact-phone"
                  className={fieldClass}
                  value={fields.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inbox-contact-title">Job title</Label>
                <Input
                  id="inbox-contact-title"
                  className={fieldClass}
                  value={fields.title}
                  onChange={(e) => setField('title', e.target.value)}
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="inbox-contact-company">Company</Label>
                <Input
                  id="inbox-contact-company"
                  className={fieldClass}
                  value={fields.company}
                  onChange={(e) => setField('company', e.target.value)}
                />
              </div>
              {fields.website ? (
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="inbox-contact-website">Website</Label>
                  <Input
                    id="inbox-contact-website"
                    className={fieldClass}
                    value={fields.website}
                    onChange={(e) => setField('website', e.target.value)}
                  />
                </div>
              ) : null}
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="inbox-contact-type">Contact type</Label>
                <select
                  id="inbox-contact-type"
                  className={`${fieldClass} w-full rounded-md border px-3`}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {INBOX_CONTACT_CATEGORIES.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inbox-contact-rel">Partner type</Label>
                <select
                  id="inbox-contact-rel"
                  className={`${fieldClass} w-full rounded-md border px-3`}
                  value={relationshipType}
                  onChange={(e) => setRelationshipType(e.target.value)}
                >
                  {PARTNER_TYPES.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inbox-contact-industry">Industry</Label>
                <select
                  id="inbox-contact-industry"
                  className={`${fieldClass} w-full rounded-md border px-3`}
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                >
                  <option value="">Select…</option>
                  {PARTNER_INDUSTRIES.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="inbox-contact-note">Notes from this conversation</Label>
            <textarea
              id="inbox-contact-note"
              rows={6}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={`${emailConversationNotePrefix(conversation.subject, null)}\nWhat you discussed, next step…`}
              className="min-h-[140px] w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/60 dark:border-white/10 dark:bg-slate-900/50"
            />
            <p className="text-[11px] text-slate-500">
              {noteOnly
                ? 'Required — this is how you log the conversation.'
                : 'Optional on first save. Later emails use Add note on this thread.'}
            </p>
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" onClick={() => void submit()} disabled={submitting || !email}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : noteOnly ? <StickyNote className="mr-2 h-4 w-4" /> : <UserPlus className="mr-2 h-4 w-4" />}
              {noteOnly ? 'Save note' : 'Create contact'}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
