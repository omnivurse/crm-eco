import { describe, expect, it } from 'vitest';
import {
  COVERAGE_SNAPSHOT_DEFAULT_ORDER,
  applyCoverageSnapshotLayout,
  coverageSnapshotLayoutStorageKey,
  coverageSnapshotModuleLabel,
  mergeCoverageSnapshotLayoutMap,
  moveCoverageSnapshotKey,
  normalizeCoverageSnapshotOrder,
  parseCoverageSnapshotLayout,
  parseCoverageSnapshotLayoutMap,
  toggleCoverageSnapshotHidden,
} from './coverage-snapshot-layout';

const janeKeys = [
  'product',
  'monthly_contribution',
  'iua_amount',
  'member_tier',
  'sharing_member_id',
  'sharing_status',
  'sharing_effective_date',
  'producer',
  'member_number',
  'referral_source',
  'referring_member',
];

describe('COVERAGE_SNAPSHOT_DEFAULT_ORDER', () => {
  it('puts referring member in the old sharing-member-id slot and the id last', () => {
    const order = [...COVERAGE_SNAPSHOT_DEFAULT_ORDER];
    expect(order.indexOf('referring_member')).toBeGreaterThan(order.indexOf('member_tier'));
    expect(order.indexOf('referring_member')).toBeLessThan(order.indexOf('sharing_status'));
    expect(order.indexOf('sharing_member_id')).toBeGreaterThan(order.indexOf('referral_source'));
    expect(order.at(-1)).toBe('sharing_member_id');
  });
});

describe('normalizeCoverageSnapshotOrder', () => {
  it('uses the premium-real-estate default when nothing is stored', () => {
    const keys = normalizeCoverageSnapshotOrder(janeKeys);
    expect(keys.indexOf('referring_member')).toBe(keys.indexOf('member_tier') + 1);
    expect(keys.at(-1)).toBe('sharing_member_id');
    expect(keys).toContain('monthly_contribution');
  });

  it('honors a custom order and appends new keys', () => {
    const keys = normalizeCoverageSnapshotOrder(janeKeys, [
      'sharing_member_id',
      'referring_member',
    ]);
    expect(keys[0]).toBe('sharing_member_id');
    expect(keys[1]).toBe('referring_member');
    expect(keys).toContain('monthly_contribution');
  });
});

describe('applyCoverageSnapshotLayout', () => {
  const fields = janeKeys.map((key) => ({ key, label: key }));

  it('sorts to the default and can hide a field', () => {
    const shown = applyCoverageSnapshotLayout(fields, null).map((f) => f.key);
    expect(shown.indexOf('referring_member')).toBeLessThan(shown.indexOf('sharing_member_id'));
    expect(shown.at(-1)).toBe('sharing_member_id');

    const hidden = applyCoverageSnapshotLayout(fields, {
      v: 1,
      order: [],
      hidden: ['sharing_member_id'],
    }).map((f) => f.key);
    expect(hidden).not.toContain('sharing_member_id');
    expect(hidden).toContain('referring_member');
  });
});

describe('move / hide helpers', () => {
  it('moves a key up and down and no-ops at the edges', () => {
    const order = ['a', 'b', 'c'];
    expect(moveCoverageSnapshotKey(order, 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(moveCoverageSnapshotKey(order, 'a', -1)).toEqual(['a', 'b', 'c']);
    expect(moveCoverageSnapshotKey(order, 'c', 1)).toEqual(['a', 'b', 'c']);
  });

  it('toggles hidden', () => {
    expect(toggleCoverageSnapshotHidden([], 'x')).toEqual(['x']);
    expect(toggleCoverageSnapshotHidden(['x'], 'x')).toEqual([]);
  });
});

describe('parseCoverageSnapshotLayout', () => {
  it('rejects junk and keeps valid lists', () => {
    expect(parseCoverageSnapshotLayout(null)).toBeNull();
    expect(parseCoverageSnapshotLayout({ order: ['referring_member'] })?.order).toEqual([
      'referring_member',
    ]);
    expect(parseCoverageSnapshotLayout({ hidden: ['sharing_member_id'] })?.hidden).toEqual([
      'sharing_member_id',
    ]);
  });
});

describe('per-module layout map', () => {
  it('keys storage and labels by module type', () => {
    expect(coverageSnapshotLayoutStorageKey('contacts')).toBe(
      'crm.coverage-snapshot-layout.contacts',
    );
    expect(coverageSnapshotModuleLabel('contacts')).toBe('Contacts');
    expect(coverageSnapshotModuleLabel('members')).toBe('Members');
  });

  it('keeps Contacts and Members layouts isolated', () => {
    const merged = mergeCoverageSnapshotLayoutMap(
      { members: { v: 1, order: ['iua_amount'], hidden: [] } },
      'contacts',
      { v: 1, order: ['referring_member'], hidden: [] },
    );
    expect(merged.contacts?.order).toEqual(['referring_member']);
    expect(merged.members?.order).toEqual(['iua_amount']);
    expect(parseCoverageSnapshotLayoutMap(merged).contacts?.order).toEqual(['referring_member']);
  });

  it('ignores a legacy unscoped blob so it cannot leak across types', () => {
    expect(
      parseCoverageSnapshotLayoutMap({ order: ['referring_member'], hidden: [] }),
    ).toEqual({});
  });

  it('reset removes only that module', () => {
    const next = mergeCoverageSnapshotLayoutMap(
      {
        contacts: { v: 1, order: ['referring_member'], hidden: [] },
        members: { v: 1, order: ['iua_amount'], hidden: [] },
      },
      'contacts',
      null,
    );
    expect(next.contacts).toBeUndefined();
    expect(next.members?.order).toEqual(['iua_amount']);
  });
});
