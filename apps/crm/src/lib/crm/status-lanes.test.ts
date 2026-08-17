import { describe, expect, it } from 'vitest';
import {
  STATUS_LANES,
  collapseStatusInFilter,
  currentListReturnTo,
  groupStatusValuesByLane,
  laneTone,
  sanitizeReturnTo,
  statusToneForValue,
  withReturnTo,
  laneCount,
  laneFilter,
  laneFilterFieldForModule,
  laneValues,
  normalizeStatusKey,
  parseStatusValuesRpcResult,
  statusLane,
  statusValuesRpcArgs,
  type StatusLane,
} from './status-lanes';

/**
 * Real PIFH spellings (contacts module, prod snapshot 2026-08-16) with the
 * lane each one must land in. Counts are the real distribution — used to
 * prove chip totals add up.
 */
const PROD_CONTACT_STATUSES: Array<[string, number, StatusLane]> = [
  ['Cancelled', 6415, 'cancelled'],
  ['Active HS Member', 3972, 'active'],
  ['In-Active', 473, 'inactive'],
  ['active', 462, 'active'],
  ['Active', 300, 'active'],
  ['Contacted', 266, 'other'],
  ['Agent - Prospect', 214, 'new'],
  ['Enrolled-2016', 185, 'active'],
  ['Future Prospect', 119, 'new'],
  ['Released', 114, 'other'],
  ['Enrolled - 2019', 109, 'active'],
  ['Lost Opportunity', 106, 'other'],
  ['Agent- SPONSOR', 96, 'other'],
  ['PERSONAL', 84, 'other'],
  ['DPC Prospect', 83, 'new'],
  ['Enrolled - 2026', 75, 'active'],
  ['Group Policy', 73, 'other'],
  ['Active ADVISOR', 71, 'active'],
  ['Decision Making Stage', 67, 'other'],
  ['Enrolled - 2025', 65, 'active'],
  ['Non Client', 48, 'other'],
  ['Enrolled - 2017', 44, 'active'],
  ['Attempted Contact One', 42, 'other'],
  ['Not Contacted', 41, 'other'],
  ['Dropout', 38, 'other'],
  ['Agency- SUPPORT', 35, 'other'],
  ['Cold Prospect - Released', 32, 'new'],
  ['Approved Pending', 31, 'pending'],
  ['Agent- PROSPECT', 30, 'new'],
  ['Sent to Webinar', 30, 'other'],
  ['Enrolled - 2018', 29, 'active'],
  ['Enrolled - 2021', 22, 'active'],
  ['Active DPC', 19, 'active'],
  ['Full Presentation Completed', 19, 'other'],
  ['Enrolled - 2024', 18, 'active'],
  ['Enrolled - 2022', 17, 'active'],
  ['Agent- SPONSOR- InActive', 15, 'inactive'],
  ['Enrolled - 2023', 14, 'active'],
  ['Product Selection', 14, 'other'],
  ['Enrolled Member', 13, 'active'],
  ['Junk Lead', 12, 'other'],
  ['Active Member', 11, 'active'],
  ['Complimentary', 11, 'other'],
  ['Accepting Provider', 9, 'other'],
  ['Warm Prospect - Maybe', 9, 'new'],
  ['Not Qualified', 9, 'other'],
  ['Warm - Future Prospect', 9, 'new'],
  ['In process', 8, 'in_process'],
  ['Attempted Contact Two', 8, 'other'],
  ['Enrolled - Direct to MCS', 7, 'active'],
  ['In Process', 6, 'in_process'],
  ['Application in Process', 6, 'in_process'],
  ['Denied by Liberty', 5, 'other'],
  ['Liberty App. Declined', 5, 'other'],
  ['LIVE', 4, 'other'],
  ['Enrolled - 2020', 4, 'active'],
  ['B Enrollment Application', 4, 'other'],
  ['No Phone Number', 4, 'other'],
  ['Cancelled Application', 4, 'cancelled'],
  ['Full Presentation Given - Decision Mode', 3, 'other'],
  ['Active HS Member - Not in MyAHE backoffice', 3, 'active'],
  ['Employee Prospect', 3, 'new'],
  ['Visited Click Funnel', 3, 'other'],
  ['Not In Liberty', 2, 'other'],
  ['Terminated', 2, 'cancelled'],
  ['Ready to Convert', 2, 'other'],
  ['E-Mail opt out', 2, 'other'],
  ['Application In Process', 2, 'in_process'],
  ['Cancellation Pending', 2, 'cancelled'],
  ['Cancelled - In New CRM', 1, 'cancelled'],
  ['Sedera Application in Process', 1, 'in_process'],
  ['LHS App Incomplete', 1, 'other'],
  ['Sedera App in Process', 1, 'in_process'],
  ['Lost in Liberty Corporate', 1, 'other'],
  ['Attempted to Contact', 1, 'other'],
  ['Qualification', 1, 'other'],
  ['Active HS Member - LHS Not Paid', 1, 'active'],
  ['App. In Process (Liberty)', 1, 'in_process'],
  ['Pending', 1, 'pending'],
  ['Hot Prospect - ready to move', 1, 'new'],
  ['Suspended', 1, 'other'],
];

describe('statusLane — real prod spellings', () => {
  it.each(PROD_CONTACT_STATUSES)('%s → %s', (raw, _count, lane) => {
    expect(statusLane(raw)).toBe(lane);
  });

  it('members + leads module spellings', () => {
    expect(statusLane('inactive')).toBe('inactive');
    expect(statusLane('Converted')).toBe('other');
    expect(statusLane('New')).toBe('new');
    expect(statusLane('Prospect')).toBe('new');
    expect(statusLane('Attempted Contact Three')).toBe('other');
    expect(statusLane('Florida Group Business')).toBe('other');
  });

  it('crm_fields.contact_status options + cron lists', () => {
    // crm_fields options: Active, Inactive, Pending, Cancelled, Deceased, Terminated
    expect(statusLane('Inactive')).toBe('inactive');
    expect(statusLane('Deceased')).toBe('cancelled');
    expect(statusLane('Canceled')).toBe('cancelled');
    // auto-activate cron pending list
    expect(statusLane('Pending HS Member')).toBe('pending');
    expect(statusLane('Pending Member')).toBe('pending');
    expect(statusLane('Pending Activation')).toBe('pending');
    expect(statusLane('Enrolled')).toBe('pending');
    expect(statusLane('Enrolled - Pending Start')).toBe('pending');
    expect(statusLane('Active Insurance Client')).toBe('active');
  });

  it('is case / space / punctuation insensitive', () => {
    expect(statusLane('  APPROVED   PENDING ')).toBe('pending');
    expect(statusLane('in-active')).toBe('inactive');
    expect(statusLane('IN_PROCESS')).toBe('in_process');
    expect(statusLane('cancelled!')).toBe('cancelled');
  });

  it('judgment calls: Approved Pending → pending, Cancellation Pending → cancelled', () => {
    expect(statusLane('Approved Pending')).toBe('pending');
    expect(statusLane('Cancellation Pending')).toBe('cancelled');
  });

  it('null / blank → other and never throws', () => {
    expect(statusLane(null)).toBe('other');
    expect(statusLane(undefined)).toBe('other');
    expect(statusLane('')).toBe('other');
    expect(statusLane('   ')).toBe('other');
  });
});

describe('STATUS_LANES', () => {
  it('has the contract order', () => {
    expect(STATUS_LANES.map((l) => l.id)).toEqual([
      'active', 'pending', 'in_process', 'new', 'inactive', 'cancelled', 'other',
    ]);
  });
});

describe('normalizeStatusKey', () => {
  it('strips everything but a-z0-9', () => {
    expect(normalizeStatusKey('App. In Process (Liberty)')).toBe('appinprocessliberty');
    expect(normalizeStatusKey(null)).toBe('');
  });
});

describe('groupStatusValuesByLane / laneCount', () => {
  const values = PROD_CONTACT_STATUSES.map(([value, count]) => ({ value, count }));

  it('every lane key exists and nothing is lost', () => {
    const grouped = groupStatusValuesByLane(values);
    const total = Object.values(grouped).flat().reduce((n, v) => n + v.count, 0);
    expect(total).toBe(values.reduce((n, v) => n + v.count, 0));
    expect(Object.keys(grouped).sort()).toEqual(
      ['active', 'cancelled', 'in_process', 'inactive', 'new', 'other', 'pending'],
    );
  });

  it('pending lane = Approved Pending + Pending only (Cancellation Pending excluded)', () => {
    const grouped = groupStatusValuesByLane(values);
    expect(grouped.pending.map((v) => v.value)).toEqual(['Approved Pending', 'Pending']);
    expect(laneCount(values, 'pending')).toBe(32);
    expect(grouped.cancelled.map((v) => v.value)).toContain('Cancellation Pending');
  });

  it('active lane count adds up across the 3 main spellings + enrolled years', () => {
    const active = laneCount(values, 'active');
    const expected = PROD_CONTACT_STATUSES.filter(([, , l]) => l === 'active').reduce((n, [, c]) => n + c, 0);
    expect(active).toBe(expected);
    expect(active).toBeGreaterThan(3972 + 462 + 300);
  });

  it('drops blank values', () => {
    const grouped = groupStatusValuesByLane([{ value: '', count: 9 }, { value: 'Pending', count: 1 }]);
    expect(grouped.other).toEqual([]);
    expect(grouped.pending).toEqual([{ value: 'Pending', count: 1 }]);
  });
});

describe('laneValues / laneFilter', () => {
  const raw = PROD_CONTACT_STATUSES.map(([v]) => v);

  it('returns only the raw values in the lane, de-duplicated, input order kept', () => {
    expect(laneValues('pending', [...raw, 'Pending'])).toEqual(['Approved Pending', 'Pending']);
    expect(laneValues('in_process', raw)).toEqual([
      'In process', 'In Process', 'Application in Process', 'Application In Process',
      'Sedera Application in Process', 'Sedera App in Process', 'App. In Process (Liberty)',
    ]);
  });

  it('emits the ModulePage filters shape with the in operator', () => {
    expect(laneFilter('pending', raw)).toEqual({
      field: 'contact_status',
      operator: 'in',
      value: ['Approved Pending', 'Pending'],
    });
    expect(laneFilter('new', ['New', 'In process', 'Converted'], 'status')).toEqual({
      field: 'status',
      operator: 'in',
      value: ['New'],
    });
  });

  it('empty lane still yields an (empty) in-filter, never "no filter"', () => {
    expect(laneFilter('pending', ['Active'])).toEqual({ field: 'contact_status', operator: 'in', value: [] });
  });

  it('laneFilterFieldForModule', () => {
    expect(laneFilterFieldForModule('contacts')).toBe('contact_status');
    expect(laneFilterFieldForModule('members')).toBe('contact_status');
    expect(laneFilterFieldForModule('leads')).toBe('status');
    expect(laneFilterFieldForModule(undefined)).toBe('status');
  });
});

describe('status-values RPC helpers', () => {
  it('builds org+module scoped aggregation args that exclude trashed rows', () => {
    const args = statusValuesRpcArgs('org-1', 'mod-1');
    expect(args.p_org_id).toBe('org-1');
    expect(args.p_module_id).toBe('mod-1');
    expect(JSON.parse(args.p_filters)).toEqual([{ field: 'deleted_at', operator: 'is_null' }]);
    expect(JSON.parse(args.p_grouping)).toEqual([{ field: 'status' }]);
    expect(JSON.parse(args.p_aggregations)).toEqual([{ field: 'id', function: 'count' }]);
  });

  it('parses the RPC payload and drops null/blank statuses', () => {
    expect(
      parseStatusValuesRpcResult({
        rows: [
          { status: 'Cancelled', count_id: 6415 },
          { status: null, count_id: 3 },
          { status: '  ', count_id: 2 },
          { status: 'Pending', count_id: '1' },
        ],
        total: 4,
      }),
    ).toEqual([
      { value: 'Cancelled', count: 6415 },
      { value: 'Pending', count: 1 },
    ]);
    expect(parseStatusValuesRpcResult(null)).toEqual([]);
    expect(parseStatusValuesRpcResult({})).toEqual([]);
  });
});

describe('laneTone / statusToneForValue', () => {
  it('maps every lane to its one tone', () => {
    expect(laneTone('active')).toBe('success');
    expect(laneTone('pending')).toBe('attention');
    expect(laneTone('in_process')).toBe('progress');
    expect(laneTone('new')).toBe('info');
    expect(laneTone('inactive')).toBe('neutral');
    expect(laneTone('cancelled')).toBe('danger');
    expect(laneTone('other')).toBe('neutral');
  });

  it('paints prod spellings by lane, so record / list / desk agree', () => {
    expect(statusToneForValue('Active HS Member')).toBe('success');
    expect(statusToneForValue('Enrolled - 2024')).toBe('success');
    expect(statusToneForValue('Cancelled')).toBe('danger');
    expect(statusToneForValue('Cancellation Pending')).toBe('danger');
    expect(statusToneForValue('Approved Pending')).toBe('attention');
    expect(statusToneForValue('In-Active')).toBe('neutral');
    expect(statusToneForValue('Application in Process')).toBe('progress');
    expect(statusToneForValue('Hot Prospect - ready to move')).toBe('info');
    // 'other' lane keeps the shared canonical StatusBadge colours (Contacted → progress)
    expect(statusToneForValue('Contacted')).toBe('progress');
    expect(statusToneForValue('Lost')).toBe('danger');
    expect(statusToneForValue('Qualified')).toBe('success');
    expect(statusToneForValue(null)).toBe('neutral');
    expect(statusToneForValue('')).toBe('neutral');
  });
});

describe('collapseStatusInFilter', () => {
  const activeValues = ['Active HS Member', 'active', 'Active', 'Enrolled-2016'];

  it('never collapses without live values (coverage cannot be proven)', () => {
    expect(collapseStatusInFilter(activeValues)).toBeNull();
  });

  it('collapses when the in-set covers ≥90% of the lane by live count', () => {
    const live = activeValues.map((value) => ({ value, count: 10 }));
    expect(collapseStatusInFilter(activeValues, live)).toEqual({
      lane: 'active',
      label: 'Active',
      values: activeValues,
    });
    // a small subset of a big lane stays raw (2 spellings = 20 of 5,030 rows)
    expect(
      collapseStatusInFilter(['active', 'Enrolled-2016'], [
        ...live,
        { value: 'Active Member', count: 5000 },
      ]),
    ).toBeNull();
  });

  it('keeps a single raw value or a mixed-lane set as a raw chip', () => {
    expect(collapseStatusInFilter(['Active'])).toBeNull();
    expect(collapseStatusInFilter(['Active', 'Cancelled'])).toBeNull();
    expect(collapseStatusInFilter(['Contacted', 'Released'])).toBeNull();
    expect(collapseStatusInFilter('Active')).toBeNull();
    expect(collapseStatusInFilter([])).toBeNull();
  });

  it('requires ≥ 90 % coverage of the lane by record count when live values are known', () => {
    const live = [
      { value: 'Active HS Member', count: 3972 },
      { value: 'active', count: 462 },
      { value: 'Active', count: 300 },
      { value: 'Cancelled', count: 6415 },
    ];
    // 3972 + 462 = 4434 / 4734 = 93.7 % → collapses even without "Active".
    expect(collapseStatusInFilter(['Active HS Member', 'active'], live)?.lane).toBe('active');
    // 462 + 300 = 762 / 4734 → raw list.
    expect(collapseStatusInFilter(['active', 'Active'], live)).toBeNull();
    // Single spelling that IS ≥ 90 % of the lane collapses too.
    expect(collapseStatusInFilter(['Cancelled'], live)?.label).toBe('Cancelled');
  });

  it('counts distinct values when live values carry no counts', () => {
    const live = ['Active HS Member', 'active', 'Active', 'Cancelled'];
    expect(collapseStatusInFilter(['Active HS Member', 'active', 'Active'], live)?.lane).toBe('active');
    expect(collapseStatusInFilter(['Active HS Member', 'active'], live)).toBeNull();
  });
});

describe('returnTo helpers', () => {
  it('honours only same-app /crm paths', () => {
    expect(sanitizeReturnTo('/crm')).toBe('/crm');
    expect(sanitizeReturnTo('/crm/modules/contacts?page=2')).toBe('/crm/modules/contacts?page=2');
    expect(sanitizeReturnTo('/crm?x=1')).toBe('/crm?x=1');
    expect(sanitizeReturnTo('//evil.com/crm')).toBeNull();
    expect(sanitizeReturnTo('https://evil.com/crm')).toBeNull();
    expect(sanitizeReturnTo('/crmx')).toBeNull();
    expect(sanitizeReturnTo('/portal')).toBeNull();
    expect(sanitizeReturnTo(null)).toBeNull();
  });

  it('appends returnTo to a record href, keeping existing query + hash', () => {
    expect(withReturnTo('/crm/r/abc', '/crm')).toBe('/crm/r/abc?returnTo=%2Fcrm');
    expect(withReturnTo('/crm/r/abc?pane=notes', '/crm/modules/contacts?page=2&filters=%5B%5D')).toBe(
      '/crm/r/abc?pane=notes&returnTo=%2Fcrm%2Fmodules%2Fcontacts%3Fpage%3D2%26filters%3D%255B%255D',
    );
    expect(withReturnTo('/crm/r/abc#top', '/crm')).toBe('/crm/r/abc?returnTo=%2Fcrm#top');
    expect(withReturnTo('/crm/r/abc?returnTo=%2Fcrm', '/crm/modules/x')).toBe('/crm/r/abc?returnTo=%2Fcrm');
    expect(withReturnTo('/crm/r/abc', 'https://evil.com')).toBe('/crm/r/abc');
    expect(withReturnTo('/crm/r/abc', null)).toBe('/crm/r/abc');
  });

  it('builds the current list location as a returnTo', () => {
    expect(currentListReturnTo('/crm/modules/contacts', 'page=2')).toBe('/crm/modules/contacts?page=2');
    expect(currentListReturnTo('/crm/modules/contacts', '?page=2')).toBe('/crm/modules/contacts?page=2');
    expect(currentListReturnTo('/crm/modules/contacts', '')).toBe('/crm/modules/contacts');
    expect(currentListReturnTo(null, 'page=2')).toBeNull();
    expect(currentListReturnTo('/portal/x', '')).toBeNull();
  });
});

describe('withReturnTo guards non-app hrefs', () => {
  it('leaves tel:/mailto:/#/absolute untouched and decorates app paths', () => {
    expect(withReturnTo('tel:5551234567', '/crm')).toBe('tel:5551234567');
    expect(withReturnTo('mailto:a@b.co', '/crm')).toBe('mailto:a@b.co');
    expect(withReturnTo('#', '/crm')).toBe('#');
    expect(withReturnTo('https://x.y/z', '/crm')).toBe('https://x.y/z');
    expect(withReturnTo('/crm/r/abc', '/crm/modules/contacts?page=2')).toBe(
      '/crm/r/abc?returnTo=%2Fcrm%2Fmodules%2Fcontacts%3Fpage%3D2',
    );
  });
});
