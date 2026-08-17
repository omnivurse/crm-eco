import { describe, it, expect } from 'vitest';
import {
  NOT_ON_FILE,
  parseIsoDate,
  calendarDaysFrom,
  formatRelativeDays,
  formatShortDate,
  formatDateWithYear,
  orNotOnFile,
  hasValue,
  initialsFor,
  telHref,
  mailtoHref,
  formatCityState,
  pendingContactsHref,
  statusTone,
  countLabel,
  recordHref,
} from './command-desk-format';

const NOW = new Date(2026, 7, 17, 10, 30); // Aug 17 2026, local

describe('parseIsoDate', () => {
  it('parses date-only strings as local dates', () => {
    const d = parseIsoDate('2026-09-01');
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(8);
    expect(d?.getDate()).toBe(1);
  });
  it('returns null for empty or garbage', () => {
    expect(parseIsoDate(null)).toBeNull();
    expect(parseIsoDate('')).toBeNull();
    expect(parseIsoDate('not a date')).toBeNull();
  });
});

describe('calendarDaysFrom / formatRelativeDays', () => {
  it('handles today / tomorrow / yesterday', () => {
    expect(formatRelativeDays('2026-08-17', NOW)).toBe('today');
    expect(formatRelativeDays('2026-08-18', NOW)).toBe('tomorrow');
    expect(formatRelativeDays('2026-08-16', NOW)).toBe('yesterday');
  });
  it('formats days, weeks, months', () => {
    expect(calendarDaysFrom('2026-08-14', NOW)).toBe(-3);
    expect(formatRelativeDays('2026-08-14', NOW)).toBe('3d ago');
    expect(formatRelativeDays('2026-08-22', NOW)).toBe('in 5d');
    expect(formatRelativeDays('2026-09-14', NOW)).toBe('in 4w');
    expect(formatRelativeDays('2026-05-01', NOW)).toBe('4mo ago');
  });
  it('uses fallback for missing', () => {
    expect(formatRelativeDays(null, NOW)).toBe('');
    expect(formatRelativeDays(null, NOW, '—')).toBe('—');
  });
  it('accepts full timestamps', () => {
    expect(formatRelativeDays('2026-08-15T23:00:00.000Z', NOW)).toMatch(/ago|yesterday|today/);
  });
});

describe('formatShortDate', () => {
  it('omits year for the current year', () => {
    expect(formatShortDate('2026-09-01', NOW)).toBe('Sep 1');
  });
  it('includes year otherwise', () => {
    expect(formatShortDate('2025-09-01', NOW)).toBe('Sep 1, 2025');
  });
  it('falls back to Not on file', () => {
    expect(formatShortDate(null, NOW)).toBe(NOT_ON_FILE);
    expect(formatShortDate('', NOW, '—')).toBe('—');
  });
});

describe('formatDateWithYear', () => {
  it('always shows the year', () => {
    expect(formatDateWithYear('1962-03-04')).toBe('Mar 4, 1962');
    expect(formatDateWithYear(null)).toBe(NOT_ON_FILE);
  });
});

describe('orNotOnFile / hasValue', () => {
  it('returns trimmed value or fallback', () => {
    expect(orNotOnFile('  Miami ')).toBe('Miami');
    expect(orNotOnFile('   ')).toBe(NOT_ON_FILE);
    expect(orNotOnFile(null)).toBe(NOT_ON_FILE);
    expect(hasValue(' x ')).toBe(true);
    expect(hasValue('  ')).toBe(false);
  });
});

describe('initialsFor', () => {
  it('prefers provided initials', () => {
    expect(initialsFor('Wendy Smith', 'ws')).toBe('WS');
  });
  it('derives from name', () => {
    expect(initialsFor('Wendy Ann Smith')).toBe('WS');
    expect(initialsFor('Cher')).toBe('C');
    expect(initialsFor('')).toBe('?');
    expect(initialsFor(null, '')).toBe('?');
  });
});

describe('telHref / mailtoHref', () => {
  it('builds tel links from formatted phones', () => {
    expect(telHref('(305) 555-1234')).toBe('tel:3055551234');
    expect(telHref('+1 305 555 1234')).toBe('tel:+13055551234');
    expect(telHref('123')).toBeNull();
    expect(telHref(null)).toBeNull();
  });
  it('builds mailto links only for plausible emails', () => {
    expect(mailtoHref(' a@b.co ')).toBe('mailto:a@b.co');
    expect(mailtoHref('nope')).toBeNull();
    expect(mailtoHref(null)).toBeNull();
  });
});

describe('formatCityState', () => {
  it('joins city and state', () => {
    expect(formatCityState('Miami', 'FL')).toBe('Miami, FL');
    expect(formatCityState('Miami', null)).toBe('Miami');
    expect(formatCityState(null, 'FL')).toBe('FL');
    expect(formatCityState(null, null)).toBeNull();
  });
});

describe('hrefs', () => {
  it('encodes the pending-lane contacts filter + waiting-longest sort', () => {
    const href = pendingContactsHref(['Approved Pending', 'Pending', 'Cancellation Pending', 'Active']);
    expect(href.startsWith('/crm/modules/contacts?')).toBe(true);
    const params = new URLSearchParams(href.split('?')[1]!);
    expect(JSON.parse(params.get('filters')!)).toEqual([
      { field: 'contact_status', operator: 'in', value: ['Approved Pending', 'Pending'] },
    ]);
    expect(params.get('sortField')).toBe('created_at');
    expect(params.get('sortDirection')).toBe('asc');
  });
  it('falls back to the canonical "Pending" option when no lane values are supplied', () => {
    for (const href of [pendingContactsHref(), pendingContactsHref([]), pendingContactsHref(null)]) {
      const params = new URLSearchParams(href.split('?')[1]!);
      expect(JSON.parse(params.get('filters')!)).toEqual([
        { field: 'contact_status', operator: 'in', value: ['Pending'] },
      ]);
    }
  });
  it('builds record hrefs, with an optional pane deep link', () => {
    expect(recordHref('abc')).toBe('/crm/r/abc');
    expect(recordHref('abc', { pane: 'notes' })).toBe('/crm/r/abc?pane=notes');
  });
});

describe('statusTone', () => {
  it('buckets common statuses', () => {
    expect(statusTone('Active HS Member')).toBe('active');
    expect(statusTone('Pending')).toBe('pending');
    expect(statusTone('Cancelled')).toBe('lost');
    expect(statusTone('In-Active')).toBe('inactive');
    expect(statusTone('Inactive')).toBe('inactive');
    expect(statusTone('Hot Prospect - ready to move')).toBe('prospect');
    expect(statusTone('Contacted')).toBe('prospect');
    expect(statusTone(null)).toBe('neutral');
    expect(statusTone('Whatever')).toBe('neutral');
  });
  it('agrees with the status lanes (chips + desk colour the same)', () => {
    expect(statusTone('Approved Pending')).toBe('pending');
    expect(statusTone('In process')).toBe('pending');
    // Cancel in flight is a cancel, not a pending member.
    expect(statusTone('Cancellation Pending')).toBe('lost');
    expect(statusTone('Enrolled - 2024')).toBe('active');
    expect(statusTone('Agent- SPONSOR- InActive')).toBe('inactive');
    expect(statusTone('Terminated')).toBe('lost');
    expect(statusTone('Converted')).toBe('active');
  });
});

describe('countLabel', () => {
  it('pluralizes', () => {
    expect(countLabel(1, 'person', 'people')).toBe('1 person');
    expect(countLabel(12, 'person', 'people')).toBe('12 people');
  });
});
