import { describe, expect, it } from 'vitest';
import { resolveFieldSaveTarget } from './record-field-registry';

describe('record-field-registry', () => {
  it('routes known row columns to row', () => {
    expect(resolveFieldSaveTarget('cancellation_date')).toBe('row');
    expect(resolveFieldSaveTarget('status')).toBe('row');
    expect(resolveFieldSaveTarget('carrier_id')).toBe('row');
  });

  it('routes unknown keys to JSONB data', () => {
    expect(resolveFieldSaveTarget('sharing_end_date')).toBe('data');
    expect(resolveFieldSaveTarget('first_name')).toBe('data');
  });
});
