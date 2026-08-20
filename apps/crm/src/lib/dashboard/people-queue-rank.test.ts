import { describe, expect, it } from 'vitest';
import {
  assemblePeopleQueue,
  buildPeopleQueueItem,
  buildReasonLabel,
  comparePeopleQueueItems,
  daysAgo,
  daysUntil,
  extractBrief,
  initialsFor,
  isPeopleQueueEmpty,
  pickNextAction,
  projectQueueRecordData,
  rankPeopleQueue,
  reasonFragment,
  shortDate,
  toIsoDate,
  type PeopleQueueRecordRow,
} from './people-queue-rank';
import type { PeopleQueueItem } from './people-queue-types';

const NOW = new Date('2026-08-17T15:00:00.000Z');

function row(over: Partial<PeopleQueueRecordRow> & { id: string }): PeopleQueueRecordRow {
  return {
    module_id: 'm-contacts',
    title: 'Jane Doe',
    email: 'jane@example.com',
    phone: '(555) 123-4567',
    status: 'Active',
    updated_at: '2026-08-10T12:00:00.000Z',
    created_at: '2026-08-01T12:00:00.000Z',
    // Complete coverage so the signal engine stays quiet unless a test wants noise.
    data: { sharing_entity: 'Zion Health', product: 'Care+' },
    ...over,
  };
}

function records(
  entries: Array<{ row: PeopleQueueRecordRow; moduleKey?: string }>,
): Map<string, { row: PeopleQueueRecordRow; moduleKey: string }> {
  return new Map(entries.map((e) => [e.row.id, { row: e.row, moduleKey: e.moduleKey ?? 'contacts' }]));
}

describe('initialsFor', () => {
  it('uses first + last word', () => {
    expect(initialsFor('Jane Q. Doe')).toBe('JD');
    expect(initialsFor('  maria   lopez ')).toBe('ML');
  });
  it('single word → first two letters; empty → ?', () => {
    expect(initialsFor('Acme')).toBe('AC');
    expect(initialsFor('')).toBe('?');
    expect(initialsFor(null)).toBe('?');
  });
});

describe('toIsoDate', () => {
  it('normalises ISO, ISO+time and US dates', () => {
    expect(toIsoDate('2026-09-01')).toBe('2026-09-01');
    expect(toIsoDate('2026-09-01T00:00:00Z')).toBe('2026-09-01');
    expect(toIsoDate('9/1/2026')).toBe('2026-09-01');
  });
  it('rejects blanks and sentinels', () => {
    expect(toIsoDate('')).toBeNull();
    expect(toIsoDate(null)).toBeNull();
    expect(toIsoDate('01/00/2000')).toBeNull();
    expect(toIsoDate('0000-00-00')).toBeNull();
  });
});

describe('date helpers', () => {
  it('daysAgo / daysUntil use UTC calendar days', () => {
    expect(daysAgo('2026-08-14', NOW)).toBe(3);
    expect(daysAgo('2026-08-17T01:00:00Z', NOW)).toBe(0);
    expect(daysUntil('2026-09-01', NOW)).toBe(15);
    expect(daysUntil(null, NOW)).toBeNull();
  });
  it('shortDate omits the current year', () => {
    expect(shortDate('2026-09-01', NOW)).toBe('Sep 1');
    expect(shortDate('2027-01-05', NOW)).toBe('Jan 5, 2027');
  });
});

describe('extractBrief', () => {
  it('resolves legacy contact keys the way the record page does (city → mailing_city)', () => {
    const r = row({
      id: 'r1',
      data: {
        city: 'Austin',
        state: 'TX',
        product: 'Care+',
        producer: 'Sam Rep',
        referring_member: 'Bob Ref',
        member_number: 'M-100',
        sharing_effective_date: '09/01/2026',
        date_of_birth: '1980-02-03',
      },
    });
    const data = projectQueueRecordData(r, 'contacts');
    expect(data.mailing_city).toBe('Austin');
    const brief = extractBrief(r, 'contacts', data);
    expect(brief.city).toBe('Austin');
    expect(brief.state).toBe('TX');
    expect(brief.plan).toBe('Care+');
    expect(brief.enrolledBy).toBe('Sam Rep');
    expect(brief.referringMember).toBe('Bob Ref');
    expect(brief.memberId).toBe('M-100');
    expect(brief.effectiveDate).toBe('2026-09-01');
    expect(brief.dateOfBirth).toBe('1980-02-03');
    expect(brief.name).toBe('Jane Doe');
    expect(brief.initials).toBe('JD');
  });

  it('does not treat referral_source or a web referrer URL as the referring member', () => {
    const r = row({
      id: 'r-ref',
      data: {
        referral_source: 'Jennifer Abbott',
        referrer: 'https://www.google.com/',
      },
    });
    const brief = extractBrief(r, 'contacts', projectQueueRecordData(r, 'contacts'));
    expect(brief.referringMember).toBeNull();
  });

  it('members: mailing_city projects onto city; plan/member id fall through the chain', () => {
    const r = row({
      id: 'r2',
      module_id: 'm-members',
      data: {
        mailing_city: 'Tulsa',
        plan_name: 'Silver',
        e123_member_id: 'E-9',
        start_date: '2026-08-20',
      },
    });
    const data = projectQueueRecordData(r, 'members');
    const brief = extractBrief(r, 'members', data);
    expect(brief.city).toBe('Tulsa');
    expect(brief.plan).toBe('Silver');
    expect(brief.memberId).toBe('E-9');
    expect(brief.effectiveDate).toBe('2026-08-20');
  });

  it('prefers normalized advisor for healthshare and blanks read as null', () => {
    const r = row({
      id: 'r3',
      market_type: 'healthshare',
      normalized_advisor_name: 'Norma Advisor',
      data: { producer: 'Ignored', referral_source: '-', member_number: 'n/a' },
    });
    const brief = extractBrief(r, 'contacts', projectQueueRecordData(r, 'contacts'));
    expect(brief.enrolledBy).toBe('Norma Advisor');
    expect(brief.referringMember).toBeNull();
    expect(brief.memberId).toBeNull();
    expect(brief.plan).toBeNull();
  });

  it('indexed status is canonical for contacts (contact_status mirrors row.status)', () => {
    const r = row({ id: 'r4', status: 'Pending', data: { contact_status: 'Active' } });
    const brief = extractBrief(r, 'contacts', projectQueueRecordData(r, 'contacts'));
    expect(brief.status).toBe('Pending');
  });

  it('falls back to first/last name then email for the display name', () => {
    const r = row({ id: 'r5', title: null, data: { first_name: 'Ana', last_name: 'Ruiz' } });
    expect(extractBrief(r, 'contacts', projectQueueRecordData(r, 'contacts')).name).toBe('Ana Ruiz');
    const r2 = row({ id: 'r6', title: '', email: 'x@y.z', data: {} });
    expect(extractBrief(r2, 'contacts', projectQueueRecordData(r2, 'contacts')).name).toBe('x@y.z');
  });
});

describe('reasonFragment / buildReasonLabel', () => {
  it('produces the approved fragments', () => {
    expect(
      reasonFragment('overdue_task', { now: NOW, task: { id: 't', title: 'Call', dueAt: '2026-08-14T09:00:00Z' } }),
    ).toBe('Task overdue 3d');
    expect(reasonFragment('task_today', { now: NOW })).toBe('Task due today');
    expect(reasonFragment('starting_soon', { now: NOW, effectiveDate: '2026-09-01' })).toBe('Starts Sep 1');
    expect(reasonFragment('starting_soon', { now: NOW, effectiveDate: '2026-08-17' })).toBe('Starts today');
    expect(reasonFragment('starting_soon', { now: NOW, effectiveDate: '2026-08-18' })).toBe('Starts tomorrow');
    // "Pending since" is measured from CREATED — a later edit must not reset it.
    expect(
      reasonFragment('pending', { now: NOW, createdAt: '2026-07-02T10:00:00Z', updatedAt: '2026-08-16T10:00:00Z' }),
    ).toBe('Pending since Jul 2');
    expect(reasonFragment('pending', { now: NOW, updatedAt: '2026-07-02T10:00:00Z' })).toBe('Pending activation');
    expect(reasonFragment('new', { now: NOW, createdAt: '2026-08-13T10:00:00Z' })).toBe('Added 4d ago');
    expect(reasonFragment('new', { now: NOW, createdAt: '2026-08-17T10:00:00Z' })).toBe('Added today');
    expect(reasonFragment('needs_attention', { now: NOW, attentionLabel: 'No phone on file' })).toBe(
      'Needs attention: No phone on file',
    );
    expect(reasonFragment('recent', { now: NOW, viewedAt: '2026-08-16T10:00:00Z' })).toBe('Viewed yesterday');
  });

  it('joins at most two fragments in priority order', () => {
    const label = buildReasonLabel(['new', 'starting_soon', 'overdue_task'], {
      now: NOW,
      task: { id: 't', title: 'Call', dueAt: '2026-08-14T09:00:00Z' },
      effectiveDate: '2026-09-01',
      createdAt: '2026-08-13T10:00:00Z',
    });
    expect(label).toBe('Task overdue 3d · Starts Sep 1');
  });
});

describe('pickNextAction', () => {
  it('attached task wins and links to the record page', () => {
    const a = pickNextAction({
      recordId: 'r1',
      primary: 'overdue_task',
      task: { id: 't', title: 'Send ID card', dueAt: null },
      phone: '555',
      now: NOW,
    });
    expect(a).toEqual({ label: 'Complete: Send ID card', href: '/crm/r/r1', kind: 'task' });
  });
  it('reason fallbacks', () => {
    expect(pickNextAction({ recordId: 'r', primary: 'starting_soon', effectiveDate: '2026-09-01', phone: '(555) 123-4567', now: NOW }))
      .toEqual({ label: 'Confirm coverage start Sep 1', href: 'tel:5551234567', kind: 'call' });
    expect(pickNextAction({ recordId: 'r', primary: 'pending', phone: null, now: NOW }))
      .toEqual({ label: 'Follow up on activation', href: '/crm/r/r', kind: 'call' });
    expect(pickNextAction({ recordId: 'r', primary: 'new', now: NOW }))
      .toEqual({ label: 'Complete the profile', href: '/crm/r/r', kind: 'open' });
    expect(pickNextAction({ recordId: 'r', primary: 'recent', now: NOW }))
      .toEqual({ label: 'Pick up where you left off', href: '/crm/r/r', kind: 'open' });
  });
  it('needs_attention uses the top rules recommendation with the real ?ai=email deep-link', () => {
    const a = pickNextAction({
      recordId: 'r',
      primary: 'needs_attention',
      topAction: { action: 'email', title: 'Email instead of calling', rationale: '', citationIds: [], confidence: 'high' },
      now: NOW,
    });
    expect(a).toEqual({ label: 'Email instead of calling', href: '/crm/r/r?ai=email', kind: 'email' });
  });
  it('falls back to Open record', () => {
    expect(pickNextAction({ recordId: 'r', primary: 'needs_attention', now: NOW }).label).toBe('Open record');
  });
});

describe('buildPeopleQueueItem', () => {
  it('adds needs_attention when the score crosses the chip threshold', () => {
    const r = row({ id: 'r1', email: null, phone: null, data: {} });
    const item = buildPeopleQueueItem({ row: r, moduleKey: 'contacts', reasons: ['new'], now: NOW });
    expect(item.attentionScore).toBeGreaterThanOrEqual(40);
    expect(item.reasons).toContain('needs_attention');
    expect(item.reason).toBe('needs_attention'); // outranks 'new'
    expect(item.reasonLabel.startsWith('Needs attention: ')).toBe(true);
  });
  it('drops starting_soon when the coalesced date is outside the window', () => {
    const r = row({ id: 'r1', data: { sharing_effective_date: '2025-01-01', start_date: '2026-09-01' } });
    const item = buildPeopleQueueItem({ row: r, moduleKey: 'contacts', reasons: ['starting_soon', 'new'], now: NOW });
    expect(item.reasons).not.toContain('starting_soon');
    expect(item.effectiveDate).toBe('2025-01-01');
  });
});

function item(over: Partial<PeopleQueueItem> & { recordId: string; reason: PeopleQueueItem['reason'] }): PeopleQueueItem {
  return {
    moduleKey: 'contacts',
    name: over.recordId,
    initials: 'XX',
    href: `/crm/r/${over.recordId}`,
    email: null,
    phone: null,
    status: null,
    marketType: null,
    city: null,
    state: null,
    dateOfBirth: null,
    plan: null,
    enrolledBy: null,
    referringMember: null,
    memberId: null,
    effectiveDate: null,
    reasons: [over.reason],
    reasonLabel: '',
    nextAction: { label: 'Open', href: '#', kind: 'open' },
    task: null,
    attentionScore: 0,
    updatedAt: null,
    ...over,
  };
}

describe('rankPeopleQueue', () => {
  it('orders by reason priority then by the per-reason tiebreak', () => {
    const items = [
      item({ recordId: 'recent', reason: 'recent', lastViewedAt: '2026-08-17T10:00:00Z' }),
      item({ recordId: 'new-old', reason: 'new', createdAt: '2026-08-01T00:00:00Z' }),
      item({ recordId: 'new-newer', reason: 'new', createdAt: '2026-08-15T00:00:00Z' }),
      item({ recordId: 'attn-lo', reason: 'needs_attention', attentionScore: 40 }),
      item({ recordId: 'attn-hi', reason: 'needs_attention', attentionScore: 90 }),
      // pending: oldest CREATED first (updated_at deliberately inverted to prove it is ignored)
      item({ recordId: 'pend-new', reason: 'pending', createdAt: '2026-08-10T00:00:00Z', updatedAt: '2026-07-01T00:00:00Z' }),
      item({ recordId: 'pend-old', reason: 'pending', createdAt: '2026-07-01T00:00:00Z', updatedAt: '2026-08-10T00:00:00Z' }),
      item({ recordId: 'start-later', reason: 'starting_soon', effectiveDate: '2026-09-10' }),
      item({ recordId: 'start-soon', reason: 'starting_soon', effectiveDate: '2026-08-20' }),
      item({ recordId: 'today', reason: 'task_today', task: { id: 't', title: 'x', dueAt: '2026-08-17T16:00:00Z' } }),
      item({ recordId: 'over-recent', reason: 'overdue_task', task: { id: 't', title: 'x', dueAt: '2026-08-15T00:00:00Z' } }),
      item({ recordId: 'over-oldest', reason: 'overdue_task', task: { id: 't', title: 'x', dueAt: '2026-02-01T00:00:00Z' } }),
    ];
    const ranked = rankPeopleQueue(items).map((i) => i.recordId);
    expect(ranked).toEqual([
      'over-oldest',
      'over-recent',
      'today',
      'start-soon',
      'start-later',
      'pend-old',
      'pend-new',
      'attn-hi',
      'attn-lo',
      'new-newer',
      'new-old',
      'recent',
    ]);
    // input untouched
    expect(items[0].recordId).toBe('recent');
  });
  it('comparator is antisymmetric on the primary reason', () => {
    const a = item({ recordId: 'a', reason: 'pending' });
    const b = item({ recordId: 'b', reason: 'new' });
    expect(comparePeopleQueueItems(a, b)).toBeLessThan(0);
    expect(comparePeopleQueueItems(b, a)).toBeGreaterThan(0);
  });
});

describe('assemblePeopleQueue', () => {
  it('dedupes by record, merges reasons, keeps the earliest task, ranks and labels', () => {
    const r1 = row({
      id: 'r1',
      created_at: '2026-08-13T10:00:00Z',
      data: { sharing_entity: 'Zion Health', product: 'Care+', start_date: '2026-09-01' },
    });
    const r2 = row({ id: 'r2', created_at: '2026-07-02T10:00:00Z', updated_at: '2026-08-16T10:00:00Z', status: 'Pending' });
    const items = assemblePeopleQueue({
      records: records([{ row: r1 }, { row: r2 }]),
      hits: [
        { recordId: 'r2', reason: 'pending' },
        { recordId: 'r1', reason: 'new' },
        { recordId: 'r1', reason: 'starting_soon' },
        { recordId: 'r1', reason: 'overdue_task', task: { id: 'tB', title: 'Later', dueAt: '2026-08-15T00:00:00Z' } },
        { recordId: 'r1', reason: 'overdue_task', task: { id: 'tA', title: 'Sooner', dueAt: '2026-08-14T00:00:00Z' } },
        { recordId: 'ghost', reason: 'pending' }, // not loaded → ignored
      ],
      now: NOW,
    });
    expect(items.map((i) => i.recordId)).toEqual(['r1', 'r2']);
    const [first, second] = items;
    expect(first.reason).toBe('overdue_task');
    expect(first.reasons).toEqual(['overdue_task', 'starting_soon', 'new']);
    expect(first.task?.id).toBe('tA');
    expect(first.reasonLabel).toBe('Task overdue 3d · Starts Sep 1');
    expect(first.nextAction).toEqual({ label: 'Complete: Sooner', href: '/crm/r/r1', kind: 'task' });
    expect(second.reason).toBe('pending');
    expect(second.reasonLabel).toBe('Pending since Jul 2');
    expect(second.nextAction.kind).toBe('call');
    expect(second.nextAction.href).toBe('tel:5551234567');
  });

  it('recent-only records fill the queue only while it is short (< 5), and never past the limit', () => {
    const strongRows = ['s1', 's2', 's3'].map((id) => row({ id }));
    const recentRows = ['v1', 'v2', 'v3', 'v4'].map((id) => row({ id }));
    const recs = records([...strongRows, ...recentRows].map((r) => ({ row: r })));
    const hits = [
      ...strongRows.map((r) => ({ recordId: r.id, reason: 'pending' as const })),
      ...recentRows.map((r, i) => ({
        recordId: r.id,
        reason: 'recent' as const,
        viewedAt: `2026-08-1${6 - i}T00:00:00Z`,
      })),
    ];
    const items = assemblePeopleQueue({ records: recs, hits, now: NOW, limit: 12 });
    // 3 strong + 2 recent fills → 5
    expect(items.map((i) => i.recordId)).toEqual(['s1', 's2', 's3', 'v1', 'v2']);
    expect(items[3].reason).toBe('recent');
    expect(items[3].nextAction.label).toBe('Pick up where you left off');

    // 5+ strong → no recent fill at all
    const strong5 = ['a', 'b', 'c', 'd', 'e'].map((id) => row({ id }));
    const items2 = assemblePeopleQueue({
      records: records([...strong5, ...recentRows].map((r) => ({ row: r }))),
      hits: [
        ...strong5.map((r) => ({ recordId: r.id, reason: 'new' as const })),
        ...recentRows.map((r) => ({ recordId: r.id, reason: 'recent' as const, viewedAt: NOW.toISOString() })),
      ],
      now: NOW,
    });
    expect(items2.every((i) => i.reason !== 'recent')).toBe(true);
    expect(items2).toHaveLength(5);

    // limit respected
    const items3 = assemblePeopleQueue({ records: recs, hits, now: NOW, limit: 2 });
    expect(items3).toHaveLength(2);
  });

  it('a record that is both recent and pending is queued once, for pending', () => {
    const r = row({ id: 'r1', status: 'Pending' });
    const items = assemblePeopleQueue({
      records: records([{ row: r }]),
      hits: [
        { recordId: 'r1', reason: 'recent', viewedAt: NOW.toISOString() },
        { recordId: 'r1', reason: 'pending' },
      ],
      now: NOW,
    });
    expect(items).toHaveLength(1);
    expect(items[0].reason).toBe('pending');
    expect(items[0].reasons).toEqual(['pending', 'recent']);
  });
});

describe('isPeopleQueueEmpty', () => {
  it('is true only when queue, rail and every count are empty', () => {
    const base = { items: [], recentlyViewed: [], counts: { tasksToday: 0, overdue: 0, pending: 0, startingSoon: 0 } };
    expect(isPeopleQueueEmpty(base)).toBe(true);
    expect(isPeopleQueueEmpty({ ...base, counts: { ...base.counts, pending: 1 } })).toBe(false);
  });
});
