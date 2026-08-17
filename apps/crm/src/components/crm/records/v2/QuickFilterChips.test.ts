import { describe, expect, it } from 'vitest';
import {
  DEFAULT_QUICK_FILTER_PRESETS,
  laneIsEmpty,
  presetIsActive,
  presetsForModule,
  resolveLanePreset,
} from './QuickFilterChips';

const CONTACT_VALUES = [
  { value: 'Cancelled', count: 6415 },
  { value: 'Active HS Member', count: 3972 },
  { value: 'active', count: 462 },
  { value: 'Active', count: 300 },
  { value: 'Approved Pending', count: 31 },
  { value: 'Cancellation Pending', count: 2 },
  { value: 'Pending', count: 1 },
];

describe('presetsForModule', () => {
  it('contacts/members: Active · Pending · Cancelled · Enrolled this month · Mine', () => {
    for (const key of ['contacts', 'members']) {
      expect(presetsForModule(key).map((p) => p.label)).toEqual([
        'Active', 'Pending', 'Cancelled', 'Enrolled this month', 'My records',
      ]);
      expect(presetsForModule(key).find((p) => p.id === 'enrolled-this-month')?.filters).toEqual([
        { field: 'created_at', operator: 'this_month', value: null },
      ]);
    }
  });

  it('leads: New · In process · Converted · Mine', () => {
    const presets = presetsForModule('leads');
    expect(presets.map((p) => p.label)).toEqual(['New', 'In process', 'Converted', 'My records']);
    expect(presets[2].filters).toEqual([{ field: 'status', operator: 'equals', value: 'Converted' }]);
  });

  it('Closed won only on deals; default row (no moduleKey) is unchanged minus Closed won', () => {
    expect(presetsForModule('deals').some((p) => p.id === 'closed-won')).toBe(true);
    expect(presetsForModule(undefined).some((p) => p.id === 'closed-won')).toBe(false);
    expect(presetsForModule('carriers').some((p) => p.id === 'closed-won')).toBe(false);
    expect(presetsForModule(undefined)).toBe(DEFAULT_QUICK_FILTER_PRESETS);
    expect(DEFAULT_QUICK_FILTER_PRESETS.map((p) => p.id)).toEqual(['mine', 'recent-week', 'new-this-week']);
  });
});

describe('resolveLanePreset', () => {
  it('builds the in-filter from the raw values in the lane and sums the count', () => {
    const pending = presetsForModule('contacts')[1];
    const { preset, count } = resolveLanePreset(pending, CONTACT_VALUES, 'contact_status');
    expect(preset.filters).toEqual([
      { field: 'contact_status', operator: 'in', value: ['Approved Pending', 'Pending'] },
    ]);
    expect(count).toBe(32);
  });

  it('cancelled lane includes Cancellation Pending', () => {
    const cancelled = presetsForModule('contacts')[2];
    const { preset, count } = resolveLanePreset(cancelled, CONTACT_VALUES, 'contact_status');
    expect(preset.filters[0].value).toEqual(['Cancelled', 'Cancellation Pending']);
    expect(count).toBe(6417);
  });
});

describe('laneIsEmpty (zero-value lane → disabled chip, never an empty in-filter)', () => {
  it('is true when no raw spelling buckets to the lane after load', () => {
    // Values with nothing in the pending lane (e.g. a module with only actives).
    const values = [{ value: 'Active', count: 12 }, { value: 'Cancelled', count: 3 }];
    const pending = presetsForModule('contacts')[1];
    const resolved = resolveLanePreset(pending, values, 'contact_status');
    expect(resolved.count).toBe(0);
    expect(resolved.preset.filters).toEqual([{ field: 'contact_status', operator: 'in', value: [] }]);
    expect(laneIsEmpty(resolved)).toBe(true);
  });

  it('is false when the lane has at least one raw value', () => {
    const pending = presetsForModule('contacts')[1];
    expect(laneIsEmpty(resolveLanePreset(pending, CONTACT_VALUES, 'contact_status'))).toBe(false);
  });

  it('never flags plain (non-lane) presets', () => {
    const mine = presetsForModule('contacts').find((p) => p.id === 'mine')!;
    expect(laneIsEmpty(resolveLanePreset(mine, [], 'contact_status'))).toBe(false);
    const enrolled = presetsForModule('contacts').find((p) => p.id === 'enrolled-this-month')!;
    expect(laneIsEmpty({ preset: enrolled, count: 0 })).toBe(false);
  });
});

describe('presetIsActive', () => {
  const [activeChip, pendingChip] = presetsForModule('contacts').map(
    (p) => resolveLanePreset(p, CONTACT_VALUES, 'contact_status').preset,
  );

  it('lane chips sharing field+operator are distinguished by value set', () => {
    const filters = pendingChip.filters;
    expect(presetIsActive(pendingChip, filters, 'all')).toBe(true);
    expect(presetIsActive(activeChip, filters, 'all')).toBe(false);
  });

  it('value-set comparison is order-insensitive', () => {
    expect(
      presetIsActive(pendingChip, [{ field: 'contact_status', operator: 'in', value: ['Pending', 'Approved Pending'] }], 'all'),
    ).toBe(true);
  });

  it('non-in presets keep the loose field+operator match', () => {
    const [enrolled] = presetsForModule('contacts').filter((p) => p.id === 'enrolled-this-month');
    expect(presetIsActive(enrolled, [{ field: 'created_at', operator: 'this_month', value: null }], 'all')).toBe(true);
    const mine = presetsForModule('contacts').find((p) => p.id === 'mine')!;
    expect(presetIsActive(mine, [], 'mine')).toBe(true);
    expect(presetIsActive(mine, [], 'all')).toBe(false);
  });
});
