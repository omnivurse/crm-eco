import { describe, expect, it } from 'vitest';
import { isDisplayOnlySortField } from './list-sort-policy';

describe('isDisplayOnlySortField', () => {
  it('disables sort on overlay / resolved columns', () => {
    expect(isDisplayOnlySortField('advisor_name')).toBe(true);
    expect(isDisplayOnlySortField('plan_name')).toBe(true);
    expect(isDisplayOnlySortField('owner_id')).toBe(true);
    expect(isDisplayOnlySortField('first_name')).toBe(false);
    expect(isDisplayOnlySortField('created_at')).toBe(false);
  });
});
