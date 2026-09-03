import { describe, expect, it } from 'vitest';
import { exportData } from './index';

describe('exportData', () => {
  it('implements xlsx as SpreadsheetML instead of throwing', async () => {
    const blob = exportData({
      format: 'xlsx',
      data: [{ name: 'Ada', amount: 12 }],
      columns: ['name', 'amount'],
    });
    expect(blob.type).toContain('excel');
    const text = await blob.text();
    expect(text).toContain('Workbook');
    expect(text).toContain('Ada');
  });
});
