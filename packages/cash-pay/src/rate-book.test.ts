import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BOOK_NAME,
  MAX_BOOKS_PER_MEMBER,
  MAX_CLIPS_PER_BOOK,
  clipIdentity,
  compileRateBook,
  sanitizeBookName,
  type RateClipSnapshot,
} from './rate-book';

function clip(partial: Partial<RateClipSnapshot> & Pick<RateClipSnapshot, 'id' | 'rate'>): RateClipSnapshot {
  return {
    hospitalId: 1,
    facilityName: 'General',
    city: 'Portland',
    state: 'Oregon',
    msaName: 'Portland-Salem',
    procedureCode: '99213',
    codeDescription: 'Office visit',
    category: 'E&M',
    paymentMethod: 'Self Pay',
    carrier: null,
    planName: null,
    lob: null,
    product: null,
    cmsRelativity: null,
    codeType: null,
    cmsRate: null,
    grossCharges: null,
    address: null,
    zip: null,
    phone: null,
    website: null,
    npi: null,
    latitude: null,
    longitude: null,
    hospitalType: null,
    healthsystemType: null,
    corporateEntity: null,
    additionalPayerNotes: null,
    methodology: null,
    queryStateName: 'Oregon',
    queryMsaName: 'Portland-Salem',
    querySpecialty: 'Hospital cash prices',
    clippedAt: '2026-08-23T00:00:00.000Z',
    sliceHigh: null,
    sliceMedian: null,
    fileSize: 100,
    ...partial,
  };
}

describe('clipIdentity', () => {
  it('is stable across the same tick', () => {
    expect(
      clipIdentity({ id: 9, facilityName: 'General', procedureCode: '99213' }),
    ).toBe('9-General-99213');
  });
});

describe('sanitizeBookName', () => {
  it('trims and rejects empty or overlong names', () => {
    expect(sanitizeBookName('  Knee  ')).toBe('Knee');
    expect(sanitizeBookName('')).toBeNull();
    expect(sanitizeBookName('   ')).toBeNull();
    expect(sanitizeBookName('x'.repeat(61))).toBeNull();
  });
});

describe('compileRateBook', () => {
  it('returns empty stats for no clips', () => {
    expect(compileRateBook([])).toEqual({
      clipCount: 0,
      cashTotal: 0,
      low: null,
      median: null,
      high: null,
      cmsMin: null,
      cmsMax: null,
      vsSliceHigh: null,
      vsSliceMedian: null,
      scope: 'book',
    });
  });

  it('compiles cash and CMS from the book, not a live file', () => {
    const stats = compileRateBook([
      clip({ id: 1, rate: 100, cmsRelativity: 1.1 }),
      clip({ id: 2, rate: 300, cmsRelativity: 2.4 }),
      clip({ id: 3, rate: 200, cmsRelativity: 1.8 }),
    ]);
    expect(stats.clipCount).toBe(3);
    expect(stats.cashTotal).toBe(600);
    expect(stats.low).toBe(100);
    expect(stats.median).toBe(200);
    expect(stats.high).toBe(300);
    expect(stats.cmsMin).toBe(1.1);
    expect(stats.cmsMax).toBe(2.4);
    expect(stats.vsSliceHigh).toBeNull();
    expect(stats.scope).toBe('book');
  });

  it('omits vs-page stats when no clip stored a page high or median', () => {
    const stats = compileRateBook([clip({ id: 1, rate: 50 })]);
    expect(stats.vsSliceHigh).toBeNull();
    expect(stats.vsSliceMedian).toBeNull();
  });

  it('sums only the under-high / under-median amounts from stored page stats', () => {
    const stats = compileRateBook([
      clip({ id: 1, rate: 80, sliceHigh: 100, sliceMedian: 90 }),
      clip({ id: 2, rate: 120, sliceHigh: 100, sliceMedian: 90 }),
      clip({ id: 3, rate: 10, sliceHigh: null, sliceMedian: null }),
    ]);
    expect(stats.vsSliceHigh).toBe(20);
    expect(stats.vsSliceMedian).toBe(10);
  });
});

describe('caps', () => {
  it('keeps the published book limits', () => {
    expect(MAX_CLIPS_PER_BOOK).toBe(50);
    expect(MAX_BOOKS_PER_MEMBER).toBe(10);
    expect(DEFAULT_BOOK_NAME).toBe('Saved rates');
  });
});
