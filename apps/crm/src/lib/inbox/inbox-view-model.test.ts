import { describe, expect, it } from 'vitest';
import {
  type ConversationView,
  effectiveLastActivity,
  hasAttachments,
  isExternalSender,
  isFlagged,
  isImportant,
  matchesQuickFilters,
  normalizeSubjectForSort,
  orderThreadForDisplay,
  shapeConversations,
} from './inbox-view-model';

function conv(overrides: Partial<ConversationView> & { id: string }): ConversationView {
  return {
    subject: null,
    contact_name: null,
    contact_email: null,
    last_message_at: '2026-09-01T12:00:00Z',
    first_message_at: '2026-09-01T12:00:00Z',
    priority: 'normal',
    assigned_to: null,
    tags: [],
    metadata: {},
    is_unread_for_user: false,
    ...overrides,
  };
}

describe('effectiveLastActivity', () => {
  it('uses the newest known time so a rewound trigger cannot sink a live thread', () => {
    // The trigger writes NEW.sent_at unconditionally, so a delayed delivery
    // with an older Date header leaves last_message_at behind the thread's
    // real newest message.
    const thread = conv({
      id: 'a',
      last_message_at: '2026-09-01T08:00:00Z',
      first_message_at: '2026-09-01T07:00:00Z',
    });
    const messages = [
      { id: 'm1', direction: 'inbound', sent_at: '2026-09-01T07:00:00Z' },
      { id: 'm2', direction: 'inbound', sent_at: '2026-09-03T18:00:00Z' },
    ];
    expect(effectiveLastActivity(thread, messages)).toBe(
      new Date('2026-09-03T18:00:00Z').getTime(),
    );
  });

  it('never returns a time older than the thread started', () => {
    const thread = conv({
      id: 'a',
      last_message_at: '2026-08-01T00:00:00Z',
      first_message_at: '2026-09-01T00:00:00Z',
    });
    expect(effectiveLastActivity(thread)).toBe(new Date('2026-09-01T00:00:00Z').getTime());
  });

  it('treats missing and unparseable times as zero rather than NaN', () => {
    expect(effectiveLastActivity(conv({ id: 'a', last_message_at: null, first_message_at: null }))).toBe(0);
    expect(effectiveLastActivity(conv({ id: 'a', last_message_at: 'not a date', first_message_at: null }))).toBe(0);
  });
});

describe('normalizeSubjectForSort', () => {
  it('groups a reply with its original the way Outlook does', () => {
    expect(normalizeSubjectForSort('Re: Invoice 10428')).toBe('invoice 10428');
    expect(normalizeSubjectForSort('RE: RE: Fwd: Invoice 10428')).toBe('invoice 10428');
    expect(normalizeSubjectForSort('FW: Invoice 10428')).toBe('invoice 10428');
    expect(normalizeSubjectForSort(null)).toBe('');
  });

  it('does not eat a subject that merely starts with those letters', () => {
    expect(normalizeSubjectForSort('Renewal packet')).toBe('renewal packet');
  });
});

describe('matchesQuickFilters', () => {
  const unread = conv({ id: 'u', is_unread_for_user: true });
  const flagged = conv({ id: 'f', tags: ['starred'] });
  const both = conv({ id: 'b', is_unread_for_user: true, tags: ['starred'] });

  it('intersects rather than unions', () => {
    expect(matchesQuickFilters(both, ['unread', 'flagged'])).toBe(true);
    expect(matchesQuickFilters(unread, ['unread', 'flagged'])).toBe(false);
    expect(matchesQuickFilters(flagged, ['unread', 'flagged'])).toBe(false);
  });

  it('passes everything when nothing is selected', () => {
    expect(matchesQuickFilters(conv({ id: 'x' }), [])).toBe(true);
  });

  it('reads attachments from the metadata intake writes, string or boolean', () => {
    expect(hasAttachments(conv({ id: 'x', metadata: { has_attachments: true } }))).toBe(true);
    expect(hasAttachments(conv({ id: 'x', metadata: { has_attachments: 'true' } }))).toBe(true);
    expect(hasAttachments(conv({ id: 'x', metadata: {} }))).toBe(false);
  });

  it('treats high and urgent as important', () => {
    expect(isImportant(conv({ id: 'x', priority: 'urgent' }))).toBe(true);
    expect(isImportant(conv({ id: 'x', priority: 'high' }))).toBe(true);
    expect(isImportant(conv({ id: 'x', priority: 'normal' }))).toBe(false);
  });

  it('fails closed on "to me" when the viewer is unknown', () => {
    const mine = conv({ id: 'x', assigned_to: 'profile-1' });
    expect(matchesQuickFilters(mine, ['to_me'], 'profile-1')).toBe(true);
    expect(matchesQuickFilters(mine, ['to_me'], 'profile-2')).toBe(false);
    expect(matchesQuickFilters(mine, ['to_me'], null)).toBe(false);
  });

  it('recognises the legacy starred tag as the flag', () => {
    expect(isFlagged(flagged)).toBe(true);
    expect(isFlagged(conv({ id: 'x', tags: null }))).toBe(false);
  });
});

describe('shapeConversations', () => {
  const older = conv({ id: 'older', last_message_at: '2026-09-01T00:00:00Z', contact_name: 'Zoe' });
  const newer = conv({ id: 'newer', last_message_at: '2026-09-03T00:00:00Z', contact_name: 'Adam' });
  const newest = conv({ id: 'newest', last_message_at: '2026-09-04T00:00:00Z', contact_name: 'Mia' });

  it('defaults to newest activity first', () => {
    const shaped = shapeConversations([older, newest, newer], {
      sort: { field: 'date', direction: 'desc' },
    });
    expect(shaped.all.map((c) => c.id)).toEqual(['newest', 'newer', 'older']);
  });

  it('reverses to oldest first on ascending date', () => {
    const shaped = shapeConversations([older, newest, newer], {
      sort: { field: 'date', direction: 'asc' },
    });
    expect(shaped.all.map((c) => c.id)).toEqual(['older', 'newer', 'newest']);
  });

  it('sorts senders A-Z on ascending, not reverse-alphabetically', () => {
    const shaped = shapeConversations([older, newest, newer], {
      sort: { field: 'from', direction: 'asc' },
    });
    expect(shaped.all.map((c) => c.contact_name)).toEqual(['Adam', 'Mia', 'Zoe']);
  });

  it('breaks equal sort keys by recency so order is stable and meaningful', () => {
    const a = conv({ id: 'a', contact_name: 'Same', last_message_at: '2026-09-01T00:00:00Z' });
    const b = conv({ id: 'b', contact_name: 'Same', last_message_at: '2026-09-05T00:00:00Z' });
    const shaped = shapeConversations([a, b], { sort: { field: 'from', direction: 'asc' } });
    expect(shaped.all.map((c) => c.id)).toEqual(['b', 'a']);
  });

  it('keeps pinned rows on top in pin order, ignoring the sort field', () => {
    const shaped = shapeConversations([older, newest, newer], {
      sort: { field: 'date', direction: 'desc' },
      pinned: ['older', 'newer'],
    });
    expect(shaped.pinned.map((c) => c.id)).toEqual(['older', 'newer']);
    expect(shaped.rest.map((c) => c.id)).toEqual(['newest']);
    expect(shaped.all.map((c) => c.id)).toEqual(['older', 'newer', 'newest']);
  });

  it('reports how many rows the Filter menu hid', () => {
    const shaped = shapeConversations([older, newest, newer], {
      sort: { field: 'date', direction: 'desc' },
      quickFilters: ['unread'],
    });
    expect(shaped.all).toHaveLength(0);
    expect(shaped.filteredOutCount).toBe(3);
  });

  it('sorts by the corrected activity time when messages are loaded', () => {
    const stale = conv({ id: 'stale', last_message_at: '2026-09-01T00:00:00Z' });
    const messagesById = new Map([
      ['stale', [{ id: 'm', direction: 'inbound', sent_at: '2026-09-09T00:00:00Z' }]],
    ]);
    const shaped = shapeConversations([stale, newest], {
      sort: { field: 'date', direction: 'desc' },
      messagesById,
    });
    expect(shaped.all.map((c) => c.id)).toEqual(['stale', 'newest']);
  });

  it('does not mutate the array it was handed', () => {
    const input = [older, newest, newer];
    shapeConversations(input, { sort: { field: 'date', direction: 'desc' } });
    expect(input.map((c) => c.id)).toEqual(['older', 'newest', 'newer']);
  });
});

describe('orderThreadForDisplay', () => {
  const messages = [
    { id: 'first', direction: 'inbound', sent_at: '2026-09-01T00:00:00Z' },
    { id: 'second', direction: 'outbound', sent_at: '2026-09-02T00:00:00Z' },
    { id: 'third', direction: 'inbound', sent_at: '2026-09-03T00:00:00Z' },
  ];

  it('puts the newest message at the top by default', () => {
    expect(orderThreadForDisplay(messages, 'newest_first').map((m) => m.id)).toEqual([
      'third',
      'second',
      'first',
    ]);
  });

  it('can still read as a chronological transcript', () => {
    expect(orderThreadForDisplay(messages, 'oldest_first').map((m) => m.id)).toEqual([
      'first',
      'second',
      'third',
    ]);
  });

  it('re-sorts a thread the server handed back out of order', () => {
    const jumbled = [messages[2], messages[0], messages[1]];
    expect(orderThreadForDisplay(jumbled, 'oldest_first').map((m) => m.id)).toEqual([
      'first',
      'second',
      'third',
    ]);
  });

  it('leaves the caller array untouched so reply targeting is unaffected', () => {
    const input = [...messages];
    orderThreadForDisplay(input, 'newest_first');
    expect(input.map((m) => m.id)).toEqual(['first', 'second', 'third']);
  });
});

describe('isExternalSender', () => {
  const domains = ['payitforwardhealth.com'];

  it('badges a stranger', () => {
    expect(isExternalSender('frank@bankofcolorado.com', domains)).toBe(true);
  });

  it('does not badge our own apex or its mail subdomain', () => {
    expect(isExternalSender('wendy@payitforwardhealth.com', domains)).toBe(false);
    expect(isExternalSender('support@mail.payitforwardhealth.com', domains)).toBe(false);
  });

  it('does not badge a registered sender on an unverified domain', () => {
    expect(isExternalSender('ops@partner.example', [], ['ops@partner.example'])).toBe(false);
  });

  it('is case and whitespace insensitive', () => {
    expect(isExternalSender('  Wendy@PayItForwardHealth.com ', domains)).toBe(false);
  });

  it('stays silent rather than guessing when there is no address', () => {
    expect(isExternalSender(null, domains)).toBe(false);
    expect(isExternalSender('', domains)).toBe(false);
    expect(isExternalSender('not-an-address', domains)).toBe(false);
  });

  it('does not treat a lookalike suffix as our domain', () => {
    expect(isExternalSender('a@notpayitforwardhealth.com', domains)).toBe(true);
  });
});
