import { describe, expect, it } from 'vitest';
import {
  isCsvUploadName,
  isExcelUploadName,
  mappingsFromCsvHeaders,
} from './csv-create-mappings';

describe('mappingsFromCsvHeaders', () => {
  it('maps Zoho-style aliases to canonical keys and keeps the raw header', () => {
    expect(
      mappingsFromCsvHeaders(['First Name', 'Email', 'Zoho ID', 'Date of Birth']),
    ).toEqual([
      { sourceColumn: 'First Name', targetField: 'first_name' },
      { sourceColumn: 'Email', targetField: 'email' },
      { sourceColumn: 'Zoho ID', targetField: 'zoho_id' },
      { sourceColumn: 'Date of Birth', targetField: 'date_of_birth' },
    ]);
  });

  it('snake-cases unknown headers instead of dropping them', () => {
    expect(mappingsFromCsvHeaders(['Coverage Option'])).toEqual([
      { sourceColumn: 'Coverage Option', targetField: 'coverage_option' },
    ]);
  });

  it('drops blank headers', () => {
    expect(mappingsFromCsvHeaders(['Email', '   ', ''])).toEqual([
      { sourceColumn: 'Email', targetField: 'email' },
    ]);
  });
});

describe('upload name checks', () => {
  it('accepts .csv and rejects Excel', () => {
    expect(isCsvUploadName('roster.CSV')).toBe(true);
    expect(isCsvUploadName('roster.xlsx')).toBe(false);
    expect(isExcelUploadName('roster.xlsx')).toBe(true);
    expect(isExcelUploadName('roster.xls')).toBe(true);
    expect(isExcelUploadName('roster.csv')).toBe(false);
  });
});
