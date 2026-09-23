/**
 * Shared rules for creating / noting a contact from an inbox thread.
 * Pure where possible so routes stay thin and tests do not need a DB.
 */

import { participantsFromThread, type ThreadParticipant } from '@/lib/calendar/thread-participants';
import {
  emailConversationNotePrefix,
  inferPartnerIndustry,
  isConversationNoteBlank,
  isInboxContactCategory,
  type ExtractedInboxContact,
  type InboxContactCategory,
  type InboxMessageForExtract,
} from '@/lib/inbox/extract-contact-from-email';

export const DEFAULT_INBOX_CONTACT_CATEGORY: InboxContactCategory = 'Partner Contact';

export interface InboxContactCandidate {
  id: string;
  title?: string | null;
}

function normalizePersonName(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Resolve an email duplicate only when it identifies one person.
 *
 * Shared household addresses are valid in CRM. When several records use the
 * same email, selecting the RPC's first row would attach the note and thread to
 * an arbitrary person because the RPC deliberately has no identity ordering.
 */
export function resolveInboxContactCandidate(
  candidates: InboxContactCandidate[],
  participantName?: string | null
): InboxContactCandidate | null {
  if (candidates.length === 1) return candidates[0]!;
  if (candidates.length === 0) return null;

  const expectedName = normalizePersonName(participantName);
  if (!expectedName) return null;
  const nameMatches = candidates.filter(
    (candidate) => normalizePersonName(candidate.title) === expectedName
  );
  return nameMatches.length === 1 ? nameMatches[0]! : null;
}

export function findThreadParticipant(
  conversation: {
    contact_email?: string | null;
    contact_name?: string | null;
    mailbox_address?: string | null;
  },
  messages: Array<{
    direction?: string | null;
    from_address?: string | null;
    from_name?: string | null;
    to_address?: string | null;
    cc_addresses?: Array<{ email: string; name?: string }> | null;
  }>,
  email: string
): ThreadParticipant | null {
  const key = email.trim().toLowerCase();
  if (!key) return null;
  const people = participantsFromThread({
    conversation,
    messages,
    excludeEmails: conversation.mailbox_address ? [conversation.mailbox_address] : [],
  });
  return people.find((p) => p.email === key) ?? null;
}

export function overlayExtractedContact(
  extracted: ExtractedInboxContact,
  overrides: Partial<Record<keyof ExtractedInboxContact, string | undefined>>
): ExtractedInboxContact {
  const pick = (key: keyof ExtractedInboxContact): string => {
    const raw = overrides[key];
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
    return extracted[key];
  };
  return {
    email: (overrides.email?.trim().toLowerCase() || extracted.email).trim().toLowerCase(),
    first_name: pick('first_name'),
    last_name: pick('last_name'),
    phone: pick('phone'),
    title: pick('title'),
    company: pick('company'),
    website: pick('website'),
  };
}

export function resolveInboxContactCategory(raw: string | null | undefined): InboxContactCategory {
  const t = (raw ?? '').trim();
  return isInboxContactCategory(t) ? t : DEFAULT_INBOX_CONTACT_CATEGORY;
}

export function buildInboxContactData(
  fields: ExtractedInboxContact,
  category: InboxContactCategory,
  extras?: { relationship_type?: string; partner_industry?: string }
): Record<string, string> {
  const out: Record<string, string> = {
    contact_category: category,
    relationship_type: extras?.relationship_type?.trim() || 'Partner',
    contact_status: 'Active',
  };
  const assign = (key: string, value: string) => {
    const t = value.trim();
    if (t) out[key] = t;
  };
  assign('first_name', fields.first_name);
  assign('last_name', fields.last_name);
  assign('email', fields.email);
  assign('phone', fields.phone);
  assign('title', fields.title);
  assign('company', fields.company);
  assign('website', fields.website);
  assign(
    'partner_industry',
    extras?.partner_industry?.trim() || inferPartnerIndustry(fields.company, fields.email)
  );
  return out;
}

export function conversationNotePrefixForThread(input: {
  subject?: string | null;
  sentAt?: string | null;
}): string {
  return emailConversationNotePrefix(input.subject, input.sentAt ?? null);
}

/** Body to insert, or null when the user left only the automatic header. */
export function conversationNoteToInsert(
  body: string | null | undefined,
  prefix: string
): string | null {
  if (body == null) return null;
  if (isConversationNoteBlank(body, prefix)) return null;
  return body.trim();
}

export function latestInboundSentAt(
  messages: Array<{
    direction?: string | null;
    sent_at?: string | null;
    created_at?: string | null;
  }>
): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i]!;
    if (m.direction === 'inbound') return m.sent_at ?? m.created_at ?? null;
  }
  return null;
}

export type { InboxMessageForExtract };
