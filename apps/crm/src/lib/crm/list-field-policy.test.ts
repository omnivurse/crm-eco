import { describe, expect, it } from 'vitest';
import {
  DISPLAY_ONLY_FIELD_HINT,
  DISPLAY_ONLY_LIST_FIELDS,
  isDisplayOnlyListField,
} from './list-field-policy';
import { DISPLAY_ONLY_SORT_HINT, isDisplayOnlySortField } from './list-sort-policy';

describe('isDisplayOnlyListField (LS-4: one policy for filter AND sort)', () => {
  it('resolved ownership columns are display-only in every module', () => {
    for (const key of ['advisor_name', 'normalized_advisor_name', 'normalized_agent_name', 'owner_id']) {
      expect(isDisplayOnlyListField(key, 'contacts'), key).toBe(true);
      expect(isDisplayOnlyListField(key, 'members'), key).toBe(true);
      expect(isDisplayOnlyListField(key, 'leads'), key).toBe(true);
      expect(isDisplayOnlyListField(key), key).toBe(true);
    }
  });

  it('members twin overlays (plan / effective date + aliases) are display-only on members only', () => {
    for (const key of ['plan_name', 'product', 'effective_date', 'sharing_effective_date']) {
      expect(isDisplayOnlyListField(key, 'members'), key).toBe(true);
      expect(isDisplayOnlyListField(key, 'contacts'), key).toBe(false);
      expect(isDisplayOnlyListField(key, 'leads'), key).toBe(false);
    }
  });

  it('without a module key the union applies (pre-LS-4 RecordTable behaviour)', () => {
    expect(isDisplayOnlyListField('plan_name')).toBe(true);
    expect(isDisplayOnlyListField('plan_name', null)).toBe(true);
    expect(isDisplayOnlyListField('plan_name', '')).toBe(true);
    expect(DISPLAY_ONLY_LIST_FIELDS).toEqual(expect.arrayContaining(['owner_id', 'plan_name', 'effective_date']));
  });

  it('ordinary stored fields stay filterable / sortable', () => {
    for (const key of ['first_name', 'created_at', 'contact_status', 'email', 'city']) {
      expect(isDisplayOnlyListField(key, 'members'), key).toBe(false);
      expect(isDisplayOnlyListField(key), key).toBe(false);
    }
  });

  it('the hint is user voice (no developer words) and the sort aliases still resolve', () => {
    expect(DISPLAY_ONLY_FIELD_HINT).not.toMatch(/display-sort|stored value|turn off/i);
    expect(DISPLAY_ONLY_FIELD_HINT).toMatch(/filter/i);
    expect(DISPLAY_ONLY_SORT_HINT).toBe(DISPLAY_ONLY_FIELD_HINT);
    expect(isDisplayOnlySortField('advisor_name')).toBe(true);
    expect(isDisplayOnlySortField('plan_name', 'contacts')).toBe(false);
    expect(isDisplayOnlySortField('first_name')).toBe(false);
  });
});
