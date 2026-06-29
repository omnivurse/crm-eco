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
});
