import { describe, expect, it } from 'vitest';
import { sortMenuFields } from './FilterChipsBar';

const FIELDS = [
  { key: 'first_name', type: 'text' },
  { key: 'plan_name', type: 'text' },
  { key: 'effective_date', type: 'date' },
  { key: 'advisor_name', type: 'text' },
  { key: 'created_at', type: 'datetime' },
  { key: 'notes', type: 'textarea' },
  { key: 'city', type: 'text' },
];

describe('sortMenuFields (LS-4: the chips-bar Sort menu never lists display-only columns)', () => {
  it('members: Plan / Effective date / Advisor are excluded, stored fields stay', () => {
    expect(sortMenuFields(FIELDS, 'members').map((f) => f.key)).toEqual([
      'first_name', 'created_at', 'city',
    ]);
  });

  it('contacts: plan_name / effective_date are their own stored values and stay sortable; advisor_name never is', () => {
    expect(sortMenuFields(FIELDS, 'contacts').map((f) => f.key)).toEqual([
      'first_name', 'plan_name', 'effective_date', 'created_at', 'city',
    ]);
  });

  it('non-sortable types (textarea) are skipped', () => {
    expect(sortMenuFields(FIELDS, 'contacts').some((f) => f.key === 'notes')).toBe(false);
  });

  it('prefers visible columns (in column order) ahead of the rest, without duplicates', () => {
    expect(
      sortMenuFields(FIELDS, 'contacts', ['city', 'plan_name', 'advisor_name', 'city']).map((f) => f.key),
    ).toEqual(['city', 'plan_name', 'first_name', 'effective_date', 'created_at']);
  });

  it('without a module key the union policy applies (plan_name excluded everywhere)', () => {
    expect(sortMenuFields(FIELDS).map((f) => f.key)).toEqual(['first_name', 'created_at', 'city']);
  });
});
