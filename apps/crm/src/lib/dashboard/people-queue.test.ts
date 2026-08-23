/**
 * DESK-1 — one row per person on the desk: a hand-entered contact and its
 * members twin (same name + phone/email, two record ids) must not both show.
 * `people-queue.ts` is server-only (pulls the cookie-bound CRM client), so
 * the Supabase module is stubbed and only the pure dedupe is exercised.
 */
import { describe, expect, it, vi } from 'vitest';
import type { PeopleQueueItem } from './people-queue-types';

vi.mock('@/lib/crm/queries', () => ({
  createCrmClient: vi.fn(),
  getCachedModules: vi.fn(),
}));

import { dedupePeopleQueueTwins } from './people-queue';

function item(over: Partial<PeopleQueueItem> & { recordId: string }): PeopleQueueItem {
  return {
    moduleKey: 'contacts',
    name: 'Pat Pending',
    initials: 'PP',
    href: `/crm/r/${over.recordId}`,
    email: 'pat.pending@example.invalid',
    phone: '5550107701',
    status: 'Pending',
    marketType: null,
    city: 'Austin',
    state: 'TX',
    dateOfBirth: null,
    plan: null,
    enrolledBy: null,
    referringMember: null,
    memberId: null,
    effectiveDate: null,
    reason: 'pending',
    reasons: ['pending'],
    reasonLabel: 'Pending 60d',
    nextAction: { label: 'Call', href: 'tel:5550107701', kind: 'call' },
    task: null,
    attentionScore: 10,
    updatedAt: null,
    ...over,
  };
}

describe('dedupePeopleQueueTwins (DESK-1)', () => {
  it('keeps the highest-ranked row and drops the members twin (same name + phone)', () => {
    const contact = item({ recordId: 'c-1', moduleKey: 'contacts' });
    const twin = item({ recordId: 'm-1', moduleKey: 'members', phone: '(555) 010-7701', email: null });
    expect(dedupePeopleQueueTwins([contact, twin]).map((i) => i.recordId)).toEqual(['c-1']);
    // Order decides the winner — the ranked list's first occurrence stays.
    expect(dedupePeopleQueueTwins([twin, contact]).map((i) => i.recordId)).toEqual(['m-1']);
  });

  it('collapses on email when the phone differs, case-insensitively', () => {
    const a = item({ recordId: 'c-1', phone: null, email: 'Pat.Pending@example.invalid' });
    const b = item({ recordId: 'm-1', phone: '5550000000', email: 'pat.pending@EXAMPLE.invalid' });
    expect(dedupePeopleQueueTwins([a, b]).map((i) => i.recordId)).toEqual(['c-1']);
  });

  it('keeps family members who share a phone but have different names', () => {
    const pat = item({ recordId: 'c-1', name: 'Pat Pending' });
    const penny = item({ recordId: 'c-2', name: 'Penny Pending', email: 'penny@example.invalid' });
    expect(dedupePeopleQueueTwins([pat, penny])).toHaveLength(2);
  });

  it('never collapses rows without a name or without phone/email, and dedupes repeated ids', () => {
    const blank1 = item({ recordId: 'x-1', name: '', phone: '5550107701' });
    const blank2 = item({ recordId: 'x-2', name: '', phone: '5550107701' });
    const noContact1 = item({ recordId: 'y-1', phone: null, email: null });
    const noContact2 = item({ recordId: 'y-2', phone: null, email: null });
    const repeat = item({ recordId: 'y-1', phone: null, email: null });
    expect(dedupePeopleQueueTwins([blank1, blank2, noContact1, noContact2, repeat]).map((i) => i.recordId)).toEqual([
      'x-1',
      'x-2',
      'y-1',
      'y-2',
    ]);
  });
});
