import { describe, expect, it } from 'vitest';
import {
  mergeCrmDataJsonIntoRowColumns,
  normalizeRowColumnValue,
} from './merge-crm-data-json-to-row';

describe('normalizeRowColumnValue', () => {
  it('returns null for empty strings so typed columns accept the write', () => {
    expect(normalizeRowColumnValue('')).toBeNull();
    expect(normalizeRowColumnValue('   ')).toBeNull();
  });

  it('returns null for stale "null" / "undefined" sentinel strings', () => {
    expect(normalizeRowColumnValue('null')).toBeNull();
    expect(normalizeRowColumnValue('undefined')).toBeNull();
  });

  it('preserves non-blank strings and other primitives', () => {
    expect(normalizeRowColumnValue('healthshare')).toBe('healthshare');
    expect(normalizeRowColumnValue(false)).toBe(false);
    expect(normalizeRowColumnValue(0)).toBe(0);
  });
});

describe('mergeCrmDataJsonIntoRowColumns', () => {
  // Regression: when a user cleared a date or lookup field in the
  // Contact edit form, `""` was being sent to Postgres for UUID/DATE
  // columns (carrier_id, original_start_date, etc.) and the UPDATE
  // failed with `invalid input syntax for type …`, surfacing as a
  // generic "can't save" error in the UI.
  it('coerces blank UUID / DATE / enum fields to null before writing to typed columns', () => {
    const updates = mergeCrmDataJsonIntoRowColumns({
      carrier_id: '',
      advisor_id: '   ',
      territory_id: 'null',
      canonical_advisor_id: 'undefined',
      original_start_date: '',
      current_year_start_date: '',
      cancellation_date: '',
      market_type: '',
      tobacco_user: '',
    });

    expect(updates.carrier_id).toBeNull();
    expect(updates.advisor_id).toBeNull();
    expect(updates.territory_id).toBeNull();
    expect(updates.canonical_advisor_id).toBeNull();
    expect(updates.original_start_date).toBeNull();
    expect(updates.current_year_start_date).toBeNull();
    expect(updates.cancellation_date).toBeNull();
    expect(updates.market_type).toBeNull();
    expect(updates.tobacco_user).toBeNull();
  });

  it('preserves real values as-is', () => {
    const updates = mergeCrmDataJsonIntoRowColumns({
      market_type: 'healthshare',
      carrier_id: '11111111-1111-1111-1111-111111111111',
      original_start_date: '2024-01-15',
      tobacco_user: false,
    });

    expect(updates.market_type).toBe('healthshare');
    expect(updates.carrier_id).toBe('11111111-1111-1111-1111-111111111111');
    expect(updates.original_start_date).toBe('2024-01-15');
    expect(updates.tobacco_user).toBe(false);
  });

  it('still derives title from first / last / preferred name', () => {
    const updates = mergeCrmDataJsonIntoRowColumns(
      { first_name: 'Anne', last_name: 'Hamill' },
      { previousTitle: 'Anne Old' }
    );
    expect(updates.title).toBe('Anne Hamill');
  });

  it('coerces blank email / phone to null (pre-existing behavior, unchanged)', () => {
    const updates = mergeCrmDataJsonIntoRowColumns({ email: '', phone: '' });
    expect(updates.email).toBeNull();
    expect(updates.phone).toBeNull();
  });

  it('contacts module: contact_status wins over inherited lead_status (Converted)', () => {
    const updates = mergeCrmDataJsonIntoRowColumns(
      { lead_status: 'Converted', contact_status: 'Pending' },
      { moduleKey: 'contacts' }
    );
    expect(updates.status).toBe('Pending');
  });

  it('contacts module: does not map lead_status alone onto row status', () => {
    const updates = mergeCrmDataJsonIntoRowColumns(
      { lead_status: 'Converted' },
      { moduleKey: 'contacts' }
    );
    expect(updates.status).toBeUndefined();
  });

  it('leads module: lead_status maps to row, contact_status can override', () => {
    const updates = mergeCrmDataJsonIntoRowColumns(
      { lead_status: 'Hot', contact_status: 'Pending' },
      { moduleKey: 'leads' }
    );
    expect(updates.status).toBe('Pending');
  });
});
