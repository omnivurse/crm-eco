import { describe, expect, it } from 'vitest';
import {
  buildRecordFieldSearchHits,
  buildRecordSearchableRows,
} from './record-field-search';
import type { CrmField, CrmRecord } from '@/lib/crm/types';

const baseRecord = {
  id: 'rec-1',
  title: 'Jane Doe',
  email: 'jane@example.com',
  phone: '555-0100',
  status: 'Active',
  stage: null,
  data: { tobacco_use: 'No' },
} as unknown as CrmRecord;

const fields = [
  { key: 'tobacco_use', label: 'Tobacco Use', display_order: 1 },
] as CrmField[];

const addressFields = [
  { key: 'mailing_street', label: 'Mailing Street', display_order: 1, section: 'address' },
  { key: 'mailing_city', label: 'Mailing City', display_order: 2, section: 'address' },
  { key: 'mailing_state', label: 'Mailing State', display_order: 3, section: 'address' },
  { key: 'mailing_zip', label: 'Mailing Zip', display_order: 4, section: 'address' },
  { key: 'iua_amount', label: 'IUA Amount', display_order: 5, section: 'coverage' },
] as CrmField[];

const addressedRecord = {
  ...baseRecord,
  data: {
    mailing_street: 'P.O. Box 4935',
    mailing_city: 'Eagle',
    mailing_state: 'CO',
    mailing_zip: '81631',
  },
} as unknown as CrmRecord;

describe('record-field-search', () => {
  it('builds searchable rows from schema + standard columns', () => {
    const rows = buildRecordSearchableRows(baseRecord, fields);
    const keys = rows.map((r) => r.fieldKey);
    expect(keys).toContain('email');
    expect(keys).toContain('tobacco_use');
  });

  it('matches field labels and values case-insensitively', () => {
    const rows = buildRecordSearchableRows(baseRecord, fields);
    const hits = buildRecordFieldSearchHits(rows, '', 'tobacco');
    expect(hits.some((h) => h.label === 'Tobacco Use')).toBe(true);
  });

  it('includes notes when note body matches', () => {
    const rows = buildRecordSearchableRows(baseRecord, fields);
    const hits = buildRecordFieldSearchHits(rows, 'Follow up next week', 'follow');
    expect(hits.some((h) => h.navigate.type === 'notes')).toBe(true);
  });

  it('finds the composed address line and the Address section by name', () => {
    const rows = buildRecordSearchableRows(addressedRecord, addressFields, 'contacts');
    const byLine = buildRecordFieldSearchHits(rows, '', 'eagle co');
    expect(byLine.some((h) => h.label === 'Address' && /4935/.test(h.snippet))).toBe(true);

    const bySection = buildRecordFieldSearchHits(rows, '', 'address');
    expect(bySection.some((h) => h.navigate.type === 'field')).toBe(true);

    const byStreet = buildRecordFieldSearchHits(rows, '', 'street');
    expect(
      byStreet.some(
        (h) => h.navigate.type === 'field' && h.navigate.fieldKey === 'mailing_street',
      ),
    ).toBe(true);

    const byPoBox = buildRecordFieldSearchHits(rows, '', 'po box');
    expect(byPoBox.some((h) => h.label === 'Address')).toBe(true);
  });

  it('jumps to an empty field when the query matches the label', () => {
    const rows = buildRecordSearchableRows(addressedRecord, addressFields, 'contacts');
    const hits = buildRecordFieldSearchHits(rows, '', 'iua');
    expect(hits.some((h) => h.navigate.type === 'field' && h.navigate.fieldKey === 'iua_amount')).toBe(
      true,
    );
  });
});
