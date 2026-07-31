/**
 * Shared-mailbox presentation for the unified inbox.
 *
 * `email_sender_addresses` is the source of truth for WHICH addresses exist —
 * this module never invents one. It only supplies the human-facing purpose
 * label and a stable ordering, because "billing@" alone does not tell an agent
 * whether that queue is member billing or vendor invoices.
 *
 * Keyed by local part so the same labels apply across domains (apex, mail.,
 * info.) without re-listing every address per domain.
 */

export const MAILBOX_PURPOSE: Record<string, string> = {
  noreply: 'System / automated',
  support: 'Member & general support',
  hello: 'General inquiries',
  membership: 'Membership / sales',
  info: 'General information',
  contact: 'Contact form',
  billing: 'Billing',
  admin: 'Admin notifications',
  privacy: 'Privacy requests',
  compliance: 'Compliance',
  legal: 'Legal',
  enrollment: 'Enrollment',
  notifications: 'System notifications',
  advocacy: 'Medical advocacy',
  security: 'Security',
};

/**
 * Display order for the sidebar. Queues a human actually works come first;
 * automated/no-reply queues sink to the bottom so they never push real member
 * mail below the fold. Anything unlisted sorts after these, alphabetically.
 */
const MAILBOX_ORDER = [
  'support',
  'membership',
  'enrollment',
  'billing',
  'advocacy',
  'hello',
  'contact',
  'info',
  'compliance',
  'privacy',
  'legal',
  'security',
  'admin',
  'notifications',
  'noreply',
];

export interface SharedMailbox {
  email: string;
  /** Purpose label, e.g. "Billing". */
  label: string;
  /** Display name from the sender registry, e.g. "Wendy Scipione". */
  name: string;
  /** Org default From address — the fallback when a thread has no mailbox. */
  isDefault: boolean;
  unreadCount: number;
}

export function mailboxLocalPart(email: string): string {
  return email.split('@')[0]?.toLowerCase() ?? '';
}

/**
 * Purpose label for an address. Falls back to a titleized local part so a
 * newly added address (e.g. `wendy@`) still renders sensibly without a code
 * change — a person's mailbox has no generic purpose to name.
 */
export function mailboxLabel(email: string, registryName?: string | null): string {
  const local = mailboxLocalPart(email);
  const purpose = MAILBOX_PURPOSE[local];
  if (purpose) return purpose;
  if (registryName?.trim()) return registryName.trim();
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export function compareMailboxes(a: string, b: string): number {
  const ia = MAILBOX_ORDER.indexOf(mailboxLocalPart(a));
  const ib = MAILBOX_ORDER.indexOf(mailboxLocalPart(b));
  // Unlisted addresses sort after every known one, then alphabetically.
  if (ia === -1 && ib === -1) return a.localeCompare(b);
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
}

/**
 * Build the sidebar list from the sender registry plus per-mailbox unread
 * counts. Addresses with no conversations still appear (count 0) so an agent
 * can see the queue exists and is simply quiet.
 */
export function buildSharedMailboxes(
  addresses: Array<{ email: string; name?: string | null; is_default?: boolean | null }>,
  unreadByMailbox: Record<string, number>,
): SharedMailbox[] {
  const seen = new Set<string>();
  const result: SharedMailbox[] = [];

  for (const addr of addresses) {
    const email = addr.email?.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    result.push({
      email,
      label: mailboxLabel(email, addr.name),
      name: addr.name?.trim() || '',
      isDefault: addr.is_default === true,
      unreadCount: unreadByMailbox[email] ?? 0,
    });
  }

  return result.sort((a, b) => compareMailboxes(a.email, b.email));
}
