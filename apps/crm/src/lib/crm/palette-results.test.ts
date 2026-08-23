import { describe, it, expect } from 'vitest';
import {
  groupPaletteResults,
  isNumericQuery,
  lastNameToken,
  namesCompatible,
  paletteResultLimit,
  normaliseName,
  resultHasEmail,
  resultEmail,
  resultPhoneDigits,
  singularModuleLabel,
  PALETTE_DEFAULT_LIMIT,
  PALETTE_NUMERIC_LIMIT,
  type PaletteSearchResult,
} from './palette-results';
import {
  PALETTE_LIVE_SEARCH_MIN,
  resolveQueuedPaletteEnter,
  shouldQueuePaletteEnter,
} from './palette-pending-enter';

const mk = (o: Partial<PaletteSearchResult> & { id: string }): PaletteSearchResult => ({
  title: 'Jane Doe',
  module: 'Contacts',
  moduleKey: 'contacts',
  url: `/crm/r/${o.id}`,
  ...o,
});

describe('groupPaletteResults', () => {
  it('folds Contact + Lead + Member with the same name into one row with three chips', () => {
    const groups = groupPaletteResults([
      mk({ id: 'c1', module: 'Contacts', moduleKey: 'contacts' }),
      mk({ id: 'l1', module: 'Leads', moduleKey: 'leads' }),
      mk({ id: 'm1', module: 'Members', moduleKey: 'members' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].isMerged).toBe(true);
    expect(groups[0].primary.id).toBe('c1');
    expect(groups[0].chips.map((c) => c.label)).toEqual(['Contact', 'Lead', 'Member']);
    expect(groups[0].chips.map((c) => c.url)).toEqual(['/crm/r/c1', '/crm/r/l1', '/crm/r/m1']);
  });

  it('matches names case/punctuation/diacritic-insensitively', () => {
    const groups = groupPaletteResults([
      mk({ id: 'c1', title: 'José  O’Neil' }),
      mk({ id: 'm1', title: 'jose o neil', module: 'Members', moduleKey: 'members' }),
    ]);
    expect(groups).toHaveLength(1);
  });

  it('keeps two same-module namesakes as separate rows', () => {
    const groups = groupPaletteResults([
      mk({ id: 'c1', title: 'John Smith' }),
      mk({ id: 'c2', title: 'John Smith' }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => !g.isMerged)).toBe(true);
  });

  it('groups by email or phone when the name matches or differs only by an initial', () => {
    const groups = groupPaletteResults([
      mk({ id: 'c1', title: 'Robert Jones', subtitle: 'bob@example.com · (555) 010-4242' }),
      mk({
        id: 'l1',
        title: 'ROBERT JONES',
        module: 'Leads',
        moduleKey: 'leads',
        subtitle: 'BOB@example.com',
      }),
      mk({
        id: 'm1',
        title: 'R. Jones',
        module: 'Members',
        moduleKey: 'members',
        subtitle: '+1 555 010 4242 · Active',
      }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].chips.map((c) => c.moduleKey)).toEqual(['contacts', 'leads', 'members']);
  });

  it('does not fold a shared email when the given names differ (nickname vs legal name)', () => {
    // "Bob" vs "Robert" is unknowable from titles alone — keep both visible.
    const groups = groupPaletteResults([
      mk({ id: 'c1', title: 'Robert Jones', subtitle: 'bob@example.com' }),
      mk({ id: 'l1', title: 'Bob Jones', module: 'Leads', moduleKey: 'leads', subtitle: 'bob@example.com' }),
    ]);
    expect(groups).toHaveLength(2);
  });

  it('folds Contact + Member with the same name AND phone into one row with chips', () => {
    const groups = groupPaletteResults([
      mk({ id: 'c1', title: 'Jane Smith', subtitle: '(555) 010-4242' }),
      mk({
        id: 'm1',
        title: 'Jane Smith',
        module: 'Members',
        moduleKey: 'members',
        subtitle: '+1 555 010 4242 · Active',
      }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].isMerged).toBe(true);
    expect(groups[0].chips.map((c) => c.label)).toEqual(['Contact', 'Member']);
  });

  it('keeps household members sharing a phone as separate rows', () => {
    const groups = groupPaletteResults([
      mk({ id: 'c1', title: 'Jane Smith', subtitle: '(555) 010-4242' }),
      mk({
        id: 'm1',
        title: 'John Smith',
        module: 'Members',
        moduleKey: 'members',
        subtitle: '+1 555 010 4242 · Active',
      }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.primary.title)).toEqual(['Jane Smith', 'John Smith']);
    expect(groups.every((g) => !g.isMerged)).toBe(true);
  });

  it('keeps household members sharing an email as separate rows', () => {
    const groups = groupPaletteResults([
      mk({ id: 'c1', title: 'Jane Smith', subtitle: 'smiths@example.com' }),
      mk({ id: 'l1', title: 'John Smith', module: 'Leads', moduleKey: 'leads', subtitle: 'smiths@example.com' }),
    ]);
    expect(groups).toHaveLength(2);
  });

  it('still folds a same-surname namesake onto the right row when a household shares a phone', () => {
    // Jane (Contact) is ranked first and owns the phone key; John (Member)
    // must NOT hide behind her, and John (Contact) must fold with John (Member).
    const groups = groupPaletteResults([
      mk({ id: 'c-jane', title: 'Jane Smith', subtitle: '(555) 010-4242' }),
      mk({ id: 'm-john', title: 'John Smith', module: 'Members', moduleKey: 'members', subtitle: '(555) 010-4242' }),
      mk({ id: 'l-john', title: 'John Smith', module: 'Leads', moduleKey: 'leads', subtitle: '(555) 010-4242' }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[1].results.map((r) => r.id)).toEqual(['m-john', 'l-john']);
  });

  it('does not fold on phone when either side has no usable surname', () => {
    const groups = groupPaletteResults([
      mk({ id: 'c1', title: 'Untitled', subtitle: '(555) 010-4242' }),
      mk({ id: 'm1', title: 'Jane Smith', module: 'Members', moduleKey: 'members', subtitle: '(555) 010-4242' }),
    ]);
    expect(groups).toHaveLength(2);
  });

  it('never groups Untitled rows by name', () => {
    const groups = groupPaletteResults([
      mk({ id: 'c1', title: 'Untitled' }),
      mk({ id: 'l1', title: 'Untitled', module: 'Leads', moduleKey: 'leads' }),
    ]);
    expect(groups).toHaveLength(2);
  });

  it('preserves rank order of primaries and handles empty input', () => {
    expect(groupPaletteResults([])).toEqual([]);
    const groups = groupPaletteResults([
      mk({ id: 'a', title: 'Alpha' }),
      mk({ id: 'b', title: 'Beta' }),
      mk({ id: 'a2', title: 'Alpha', module: 'Leads', moduleKey: 'leads' }),
    ]);
    expect(groups.map((g) => g.key)).toEqual(['a', 'b']);
    expect(groups[0].results.map((r) => r.id)).toEqual(['a', 'a2']);
  });
});

describe('numeric query limit', () => {
  it('detects phone / member numbers', () => {
    expect(isNumericQuery('5550104242')).toBe(true);
    expect(isNumericQuery('(555) 010-4242')).toBe(true);
    expect(isNumericQuery('+1 555.010.4242')).toBe(true);
    expect(isNumericQuery('1234')).toBe(true);
    expect(isNumericQuery('123')).toBe(false);
    expect(isNumericQuery('john 42')).toBe(false);
    expect(isNumericQuery('PIF-12345')).toBe(false);
    expect(isNumericQuery('')).toBe(false);
  });

  it('raises the limit for numeric queries only', () => {
    expect(paletteResultLimit('Jane')).toBe(PALETTE_DEFAULT_LIMIT);
    expect(paletteResultLimit('555 010 4242')).toBe(PALETTE_NUMERIC_LIMIT);
    expect(PALETTE_NUMERIC_LIMIT).toBeGreaterThan(PALETTE_DEFAULT_LIMIT);
    expect(PALETTE_NUMERIC_LIMIT).toBeLessThanOrEqual(100);
  });
});

describe('field extraction helpers', () => {
  it('finds email via matches first, then subtitle', () => {
    expect(
      resultEmail(
        mk({
          id: 'x',
          subtitle: 'other@x.com',
          matches: [{ fieldKey: 'email', label: 'Email', category: 'email', value: 'A@B.co', ranges: [] }],
        }),
      ),
    ).toBe('a@b.co');
    expect(resultEmail(mk({ id: 'x', subtitle: 'foo@bar.com · Active' }))).toBe('foo@bar.com');
    expect(resultHasEmail(mk({ id: 'x', subtitle: 'Active' }))).toBe(false);
    expect(resultHasEmail(mk({ id: 'x' }))).toBe(false);
  });

  it('extracts phone digits (last 10) and ignores short numbers / emails', () => {
    expect(resultPhoneDigits(mk({ id: 'x', subtitle: '+1 (555) 010-4242' }))).toBe('5550104242');
    expect(resultPhoneDigits(mk({ id: 'x', subtitle: 'a1@b.com · Active' }))).toBeNull();
    expect(resultPhoneDigits(mk({ id: 'x', subtitle: '123' }))).toBeNull();
  });

  it('extracts the surname token, dropping generational suffixes', () => {
    expect(lastNameToken('John Smith')).toBe('smith');
    expect(lastNameToken("Mary-Kate O'Brien Jr")).toBe('brien');
    expect(lastNameToken('Robert Jones III')).toBe('jones');
    expect(lastNameToken('Untitled')).toBe('');
    expect(lastNameToken(null)).toBe('');
  });

  it('judges name compatibility for contact-key folding', () => {
    expect(namesCompatible('Jane Smith', 'jane  smith')).toBe(true);
    expect(namesCompatible('R. Jones', 'Robert Jones')).toBe(true);
    expect(namesCompatible('Robert Jones Jr', 'Robert Jones')).toBe(true);
    expect(namesCompatible('John A Smith', 'John Smith')).toBe(true);
    expect(namesCompatible('Jane Smith', 'John Smith')).toBe(false);
    expect(namesCompatible('Jo Smith', 'John Smith')).toBe(false);
    expect(namesCompatible('Smith', 'John Smith')).toBe(false);
    expect(namesCompatible('Untitled', 'Untitled')).toBe(false);
    expect(namesCompatible(null, 'John Smith')).toBe(false);
  });

  it('normalises names and singularises module labels', () => {
    expect(normaliseName('  Mary-Kate  O’Brien ')).toBe('mary kate o brien');
    expect(normaliseName(null)).toBe('');
    expect(singularModuleLabel('Contacts')).toBe('Contact');
    expect(singularModuleLabel('Policies')).toBe('Policy');
    expect(singularModuleLabel('Address')).toBe('Address');
    expect(singularModuleLabel('Member')).toBe('Member');
  });
});

describe('Enter while the record search is in flight (TE-5)', () => {
  it('queues Enter only when loading, the query is searchable and no row is on screen', () => {
    expect(shouldQueuePaletteEnter({ searchLoading: true, query: '5550107788', visibleRowCount: 0 })).toBe(true);
    expect(shouldQueuePaletteEnter({ searchLoading: true, query: ' 55 ', visibleRowCount: 0 })).toBe(true);
    expect(shouldQueuePaletteEnter({ searchLoading: false, query: '5550107788', visibleRowCount: 0 })).toBe(false);
    expect(shouldQueuePaletteEnter({ searchLoading: true, query: '5', visibleRowCount: 0 })).toBe(false);
    expect(shouldQueuePaletteEnter({ searchLoading: true, query: '5550107788', visibleRowCount: 1 })).toBe(false);
    expect(PALETTE_LIVE_SEARCH_MIN).toBe(2);
  });

  it('waits while the same query is loading, opens the sole single-chip row when results land', () => {
    const base = { queuedQuery: '5550107788', query: '5550107788' };
    expect(resolveQueuedPaletteEnter({ ...base, searchLoading: true, recordRows: [], visibleRowCount: 0 })).toBe('wait');
    expect(resolveQueuedPaletteEnter({ ...base, searchLoading: false, recordRows: [{ chipCount: 1 }], visibleRowCount: 1 })).toBe('open');
    expect(resolveQueuedPaletteEnter({ ...base, searchLoading: false, recordRows: [{ chipCount: 0 }], visibleRowCount: 1 })).toBe('open');
  });

  it('drops the queued Enter when nothing matches, when several rows or twins come back, or when a command row joins', () => {
    const base = { queuedQuery: '5550107788', query: '5550107788', searchLoading: false };
    expect(resolveQueuedPaletteEnter({ ...base, recordRows: [], visibleRowCount: 0 })).toBe('drop');
    // Shared-phone household → two rows → the rep picks.
    expect(resolveQueuedPaletteEnter({ ...base, recordRows: [{ chipCount: 1 }, { chipCount: 1 }], visibleRowCount: 2 })).toBe('drop');
    // Contact + Member twin folded into one row with two chips → ambiguous.
    expect(resolveQueuedPaletteEnter({ ...base, recordRows: [{ chipCount: 2 }], visibleRowCount: 1 })).toBe('drop');
    // One record plus a matching command row → not the sole row.
    expect(resolveQueuedPaletteEnter({ ...base, recordRows: [{ chipCount: 1 }], visibleRowCount: 2 })).toBe('drop');
  });

  it('drops the queue when the query moved on or nothing was queued (Escape)', () => {
    expect(resolveQueuedPaletteEnter({ queuedQuery: '5550107788', query: '55501077889', searchLoading: false, recordRows: [{ chipCount: 1 }], visibleRowCount: 1 })).toBe('drop');
    expect(resolveQueuedPaletteEnter({ queuedQuery: '5550107788', query: '5550107788 ', searchLoading: false, recordRows: [{ chipCount: 1 }], visibleRowCount: 1 })).toBe('open');
    expect(resolveQueuedPaletteEnter({ queuedQuery: null, query: '5550107788', searchLoading: false, recordRows: [{ chipCount: 1 }], visibleRowCount: 1 })).toBe('drop');
  });
});
