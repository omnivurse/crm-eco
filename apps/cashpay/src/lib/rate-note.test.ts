import { afterEach, describe, expect, it, vi } from 'vitest';
import { brand } from './brand';
import { buildRateNoteHtml, escapeHtml, openRateNote, type RateNoteTick } from './rate-note';

const rateNoteTick: RateNoteTick = {
  facilityName: 'Mercy Hospital',
  payer: 'Anthem · Medicare',
  procedureCode: '99213',
  rate: 184,
  cmsRelativity: 1.12,
  cmsRate: 164,
  city: 'Portland',
  state: 'OR',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Cash Pay Advocate brand', () => {
  it('locks the advocate tagline and logo-sampled palette', () => {
    expect(brand.advocate).toBe('Cash Pay Advocate');
    expect(brand.tagline).toBe('Fair for All.');
    expect(brand.logo).toBe('/logo.png');
    expect(brand.logoIcon).toBe('/logo-icon.png');
    expect(brand.colors.violet).toBe('#3B145B');
    expect(brand.colors.teal).toBe('#1088A2');
    expect(brand.colors.bronze).toBe('#AC641F');
    expect(brand.signal).toBe('#8A4E12');
  });
});

describe('rate note PDF', () => {
  it('escapes HTML in facility names', () => {
    expect(escapeHtml('St. Mary\'s <script> & "Co"')).toBe(
      'St. Mary\'s &lt;script&gt; &amp; &quot;Co&quot;',
    );
  });

  it('embeds the logo, tagline, and bronze cash figure', () => {
    const html = buildRateNoteHtml({
      ticks: [rateNoteTick],
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

  it('populates an opened window after severing its opener', () => {
    const document = {
      open: vi.fn(),
      write: vi.fn(),
      close: vi.fn(),
    };
    const popup = { document, opener: {} };
    const open = vi.fn(() => popup);
    vi.stubGlobal('window', {
      open,
      location: { origin: 'https://cashpay.example' },
    });

    expect(
      openRateNote({
        ticks: [rateNoteTick],
        metro: 'Portland-Salem',
        procedureCode: '99213',
      }),
    ).toBe(true);
    expect(open).toHaveBeenCalledWith('', '_blank', 'width=900,height=720');
    expect(popup.opener).toBeNull();
    expect(document.write).toHaveBeenCalledWith(expect.stringContaining('Mercy Hospital'));
    expect(document.close).toHaveBeenCalledOnce();
  });

  it('reports a genuinely blocked popup', () => {
    vi.stubGlobal('window', {
      open: vi.fn(() => null),
      location: { origin: 'https://cashpay.example' },
    });

    expect(
      openRateNote({
        ticks: [rateNoteTick],
        metro: 'Portland-Salem',
        procedureCode: '99213',
      }),
    ).toBe(false);
  });
});
