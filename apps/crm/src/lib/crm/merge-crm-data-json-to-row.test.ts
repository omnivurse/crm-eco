import { describe, expect, it } from 'vitest';
import {
  mergeCrmDataJsonIntoRowColumns,
  normalizeRowColumnValue,
  normalizeDateColumnValue,
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

  // Regression: when a carrier picker uses "Use as text" fallback,
  // the free-text (e.g. "LifeX Co Pay PPO 500 ded") must NOT be synced
  // to the UUID carrier_id column, or Postgres will return
  // "invalid input syntax for type uuid: ...".
  it('coerces non-UUID free-text to null for UUID-typed columns', () => {
    const updates = mergeCrmDataJsonIntoRowColumns({
      carrier_id: 'LifeX Co Pay PPO 500 ded',
      advisor_id: 'some-text-not-uuid',
      territory_id: 'ABC Corp',
    });

    expect(updates.carrier_id).toBeNull();
    expect(updates.advisor_id).toBeNull();
    expect(updates.territory_id).toBeNull();
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

  it('leads module: lead_status wins over contact_status when both are present', () => {
    const updates = mergeCrmDataJsonIntoRowColumns(
      { lead_status: 'Converted', contact_status: 'In Process' },
      { moduleKey: 'leads' }
    );
    expect(updates.status).toBe('Converted');
  });

  it('leads module: contact_status maps when lead_status is omitted', () => {
    const updates = mergeCrmDataJsonIntoRowColumns(
      { contact_status: 'Pending' },
      { moduleKey: 'leads' }
    );
    expect(updates.status).toBe('Pending');
  });

  // Regression: a date string like "6/1/26" in an indexed DATE column would
  // be parsed by Postgres as June 1, year 26 AD. Date columns must be
  // normalised to ISO with a Y2K pivot before they reach the database.
  it('normalises a 2-digit-year US date to ISO with Y2K pivot before writing the column', () => {
    const updates = mergeCrmDataJsonIntoRowColumns({
      original_start_date: '6/1/26',
      current_year_start_date: '12/31/29',
      cancellation_date: '4/15/68',
    });
    expect(updates.original_start_date).toBe('2026-06-01');
    expect(updates.current_year_start_date).toBe('2029-12-31');
    expect(updates.cancellation_date).toBe('1968-04-15');
  });

  it('passes through a clean ISO date unchanged', () => {
    const updates = mergeCrmDataJsonIntoRowColumns({
      original_start_date: '2024-03-15',
    });
    expect(updates.original_start_date).toBe('2024-03-15');
  });

  it('mirrors legacy start_date JSONB into original_start_date for the activation cron', () => {
    const updates = mergeCrmDataJsonIntoRowColumns({
      start_date: '7/1/2026',
    });
    expect(updates.original_start_date).toBe('2026-07-01');
    expect(updates.current_year_start_date).toBe('2026-07-01');
  });

  it('does not overwrite explicit original_start_date when start_date is also sent', () => {
    const updates = mergeCrmDataJsonIntoRowColumns({
      start_date: '7/1/2026',
      original_start_date: '2026-08-01',
    });
    expect(updates.original_start_date).toBe('2026-08-01');
    expect(updates.current_year_start_date).toBeUndefined();
  });

  it('prefers lead_status over contact_status on lead modules (converted-lead drift guard)', () => {
    const updates = mergeCrmDataJsonIntoRowColumns(
      { lead_status: 'Converted', contact_status: 'In Process' },
      { moduleKey: 'leads' },
    );
    expect(updates.status).toBe('Converted');
  });

  it('mirrors health_insurance_start_date to original_start_date', () => {
    const updates = mergeCrmDataJsonIntoRowColumns({
      health_insurance_start_date: '2026-07-01',
    });
    expect(updates.original_start_date).toBe('2026-07-01');
  });

  it('rejects un-pivotable garbage in DATE columns by returning null', () => {
    const updates = mergeCrmDataJsonIntoRowColumns({
      original_start_date: 'not a date',
    });
    expect(updates.original_start_date).toBeNull();
  });
});

describe('normalizeDateColumnValue', () => {
  it('passes ISO YYYY-MM-DD through unchanged', () => {
    expect(normalizeDateColumnValue('2024-03-15')).toBe('2024-03-15');
  });

  it('strips a T-suffixed timestamp down to the date portion', () => {
    expect(normalizeDateColumnValue('2024-03-15T08:30:00Z')).toBe('2024-03-15');
  });

  it('pivots ISO with 2-digit year (the historic 0026 bug)', () => {
    expect(normalizeDateColumnValue('0026-06-01')).toBe('2026-06-01');
    expect(normalizeDateColumnValue('0099-04-15')).toBe('1999-04-15');
  });

  it('parses MM/DD/YYYY (US 4-digit)', () => {
    expect(normalizeDateColumnValue('6/1/2026')).toBe('2026-06-01');
    expect(normalizeDateColumnValue('06/01/2026')).toBe('2026-06-01');
  });

  it('parses MM/DD/YY with Y2K pivot', () => {
    expect(normalizeDateColumnValue('6/1/26')).toBe('2026-06-01');
    expect(normalizeDateColumnValue('1/1/29')).toBe('2029-01-01');
    expect(normalizeDateColumnValue('4/15/68')).toBe('1968-04-15');
    expect(normalizeDateColumnValue('1/1/99')).toBe('1999-01-01');
  });

  it('returns null for blank / sentinel / garbage values', () => {
    expect(normalizeDateColumnValue('')).toBeNull();
    expect(normalizeDateColumnValue('   ')).toBeNull();
    expect(normalizeDateColumnValue('null')).toBeNull();
    expect(normalizeDateColumnValue('0000-00-00')).toBeNull();
    expect(normalizeDateColumnValue('not a date')).toBeNull();
    expect(normalizeDateColumnValue(null)).toBeNull();
    expect(normalizeDateColumnValue(undefined)).toBeNull();
  });

  it('handles Date instances by formatting in UTC', () => {
    expect(normalizeDateColumnValue(new Date('2026-06-01T00:00:00Z'))).toBe('2026-06-01');
    expect(normalizeDateColumnValue(new Date('invalid'))).toBeNull();
  });
});
