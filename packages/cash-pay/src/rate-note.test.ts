import { describe, expect, it } from 'vitest';
import { CASH_PAY_BRAND } from './brand';
import { buildBookRateNoteHtml, buildCompareRateNoteHtml, escapeHtml } from './rate-note';

describe('Cash Pay Advocate brand', () => {
  it('locks the advocate tagline and logo-sampled palette', () => {
    expect(CASH_PAY_BRAND.advocate).toBe('Cash Pay Advocate');
    expect(CASH_PAY_BRAND.tagline).toBe('Fair for All.');
    expect(CASH_PAY_BRAND.colors.violet).toBe('#3B145B');
    expect(CASH_PAY_BRAND.colors.teal).toBe('#1088A2');
    expect(CASH_PAY_BRAND.colors.bronze).toBe('#AC641F');
    expect(CASH_PAY_BRAND.signal).toBe('#8A4E12');
  });
});

describe('rate note PDF', () => {
  it('escapes HTML in facility names', () => {
    expect(escapeHtml('St. Mary\'s <script> & "Co"')).toBe(
      'St. Mary\'s &lt;script&gt; &amp; &quot;Co&quot;',
    );
  });

  it('embeds the logo, tagline, and bronze cash on a compare sheet', () => {
    const html = buildCompareRateNoteHtml({
      ticks: [
        {
          facilityName: 'Mercy Hospital',
          payer: 'Anthem · Medicare',
          procedureCode: '99213',
          rate: 184,
          cmsRelativity: 1.12,
          cmsRate: 164,
          city: 'Portland',
          state: 'OR',
        },
      ],
      metro: 'Portland-Salem',
      procedureCode: '99213',
      asOf: '9/12/2026',
      logoUrl: 'https://cashpay.example/logo.png',
    });

    expect(html).toContain('src="https://cashpay.example/logo.png"');
    expect(html).toContain('Fair for All.');
    expect(html).toContain('Cash Pay Advocate');
    expect(html).toContain('#8A4E12');
    expect(html).toContain('$184');
    expect(html).toContain('Mercy Hospital');
    expect(html).not.toContain('<script>alert');
  });

  it('embeds the helix mark and book stats on a member rate note', () => {
    const html = buildBookRateNoteHtml({
      bookName: 'Knee <b>surgery</b>',
      memberName: 'Ada Lovelace',
      postalCode: '97201',
      asOf: '9/13/2026',
      logoUrl: 'https://portal.example/cashpay-logo.png',
      compile: {
        clipCount: 1,
        cashTotal: 184,
        low: 184,
        median: 184,
        high: 184,
        cmsMin: 1.12,
        cmsMax: 1.12,
        vsSliceHigh: 40,
        vsSliceMedian: 10,
        scope: 'book',
      },
      clips: [
        {
          facilityName: 'Mercy Hospital',
          paymentMethod: 'Self Pay',
          procedureCode: '99213',
          rate: 184,
          cmsRelativity: 1.12,
          queryStateName: 'Oregon',
          queryMsaName: 'Portland-Salem',
          clippedAt: '2026-09-13T00:00:00.000Z',
        },
      ],
    });

    expect(html).toContain('src="https://portal.example/cashpay-logo.png"');
    expect(html).toContain('Fair for All.');
    expect(html).toContain('Cash Pay Advocate');
    expect(html).toContain('#8A4E12');
    expect(html).toContain('Ada Lovelace');
    expect(html).toContain('ZIP 97201');
    expect(html).toContain('Knee &lt;b&gt;surgery&lt;/b&gt;');
    expect(html).toContain('$184');
    expect(html).toContain('$40');
    expect(html).not.toContain('#d97706');
    expect(html).not.toContain('<b>surgery</b>');
  });
});
