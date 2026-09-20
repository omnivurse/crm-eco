import { CASH_PAY_BRAND, type CashPayBrand } from './brand';
import type { RateBookCompile } from './rate-book';

export type RateNoteTick = {
  facilityName: string;
  payer: string;
  procedureCode: string;
  rate: number;
  cmsRelativity: number | null;
  cmsRate?: number | null;
  city?: string | null;
  state?: string | null;
};

export type CompareRateNoteInput = {
  ticks: RateNoteTick[];
  metro: string;
  procedureCode: string;
  asOf: string;
  logoUrl: string;
  brand?: CashPayBrand;
};

export type BookRateNoteClip = {
  facilityName: string;
  paymentMethod: string | null;
  procedureCode: string;
  rate: number;
  cmsRelativity: number | null;
  queryStateName: string;
  queryMsaName: string;
  clippedAt: string;
};

export type BookRateNoteInput = {
  bookName: string;
  memberName: string;
  postalCode: string;
  asOf: string;
  logoUrl: string;
  compile: RateBookCompile;
  clips: BookRateNoteClip[];
  brand?: CashPayBrand;
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatRateNoteMoney(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNeedle(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '';
  return `${value.toFixed(2)}× Medicare`;
}

function sheetCss(brand: CashPayBrand): string {
  return `
  * { box-sizing: border-box; }
  body { margin: 0; padding: 28px; background: ${brand.colors.mist}; color: ${brand.colors.violet};
    font-family: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif; }
  .sheet { max-width: 760px; margin: 0 auto; background: #fff;
    border: 1px solid color-mix(in srgb, ${brand.colors.teal} 22%, #d7e4e7); padding: 28px 30px; }
  .mast { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
  .mast img { height: 52px; width: auto; }
  .tagline { margin: 0; font-size: 13px; letter-spacing: 0.14em; text-transform: uppercase;
    color: ${brand.colors.tealInk}; font-weight: 700; }
  .kicker { margin: 0 0 6px; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;
    color: ${brand.colors.tealInk}; }
  h1 { margin: 0 0 4px; font-size: 22px; letter-spacing: -0.03em; color: ${brand.colors.violet}; }
  .meta { margin: 0 0 18px; font-size: 13px; color: color-mix(in srgb, ${brand.colors.violet} 62%, #fff); }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 0 0 18px; }
  .stats.cols-4 { grid-template-columns: repeat(4, 1fr); }
  .stat { padding: 10px 12px; background: ${brand.colors.mist};
    border: 1px solid color-mix(in srgb, ${brand.colors.teal} 18%, #e4ecef); }
  .stat span { display: block; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase;
    color: ${brand.colors.tealInk}; }
  .stat strong { display: block; margin-top: 4px; font-family: ui-monospace, Menlo, monospace; font-size: 16px; }
  .cash { color: ${brand.colors.bronzeInk}; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase;
    color: ${brand.colors.tealInk}; border-bottom: 1px solid color-mix(in srgb, ${brand.colors.teal} 22%, #d7e4e7);
    padding: 6px 6px 8px; }
  td { padding: 8px 6px; border-bottom: 1px solid #eef4f5; vertical-align: top; }
  .mono { font-family: ui-monospace, Menlo, monospace; }
  .foot { margin-top: 18px; font-size: 12px; color: color-mix(in srgb, ${brand.colors.violet} 58%, #fff); }
  .noprint { text-align: center; margin-top: 16px; }
  button { min-height: 40px; padding: 0 14px; border: 1px solid ${brand.colors.tealInk};
    background: #fff; color: ${brand.colors.violet}; cursor: pointer; }
  @media print {
    body { background: #fff; padding: 0; }
    .noprint { display: none; }
    .sheet { border: 0; }
  }`;
}

function mast(logoUrl: string, brand: CashPayBrand): string {
  return `<div class="mast">
      <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(brand.name)}" />
      <p class="tagline">${escapeHtml(brand.tagline)}</p>
    </div>
    <p class="kicker">${escapeHtml(brand.advocate)}</p>`;
}

function wrapDocument(args: {
  title: string;
  brand: CashPayBrand;
  body: string;
}): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<title>${escapeHtml(args.title)}</title>
<style>${sheetCss(args.brand)}</style></head>
<body>
  <div class="sheet">
    ${args.body}
  </div>
  <div class="noprint"><button type="button" onclick="window.print()">Print / Save as PDF</button></div>
  <script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 300); });</script>
</body></html>`;
}

export function buildCompareRateNoteHtml(input: CompareRateNoteInput): string {
  const brand = input.brand ?? CASH_PAY_BRAND;
  const rows = input.ticks
    .map((tick) => {
      const place = [tick.city, tick.state].filter(Boolean).join(', ');
      return `<tr>
        <td>${escapeHtml(tick.facilityName)}</td>
        <td>${escapeHtml(tick.payer)}</td>
        <td class="mono">${escapeHtml(tick.procedureCode)}</td>
        <td class="cash">${escapeHtml(formatRateNoteMoney(tick.rate))}</td>
        <td class="mono">${escapeHtml(formatNeedle(tick.cmsRelativity) || '—')}</td>
        <td>${escapeHtml(place || '—')}</td>
      </tr>`;
    })
    .join('');

  const cashLow = input.ticks.reduce((min, tick) => Math.min(min, tick.rate), Number.POSITIVE_INFINITY);
  const cashHigh = input.ticks.reduce((max, tick) => Math.max(max, tick.rate), 0);

  return wrapDocument({
    title: `${brand.product} rate note · ${brand.tagline}`,
    brand,
    body: `${mast(input.logoUrl, brand)}
    <h1>Rate note</h1>
    <p class="meta">${escapeHtml(input.metro || 'No metro selected')}${
      input.procedureCode ? ` · CPT ${escapeHtml(input.procedureCode)}` : ''
    } · ${escapeHtml(input.asOf)}</p>
    <div class="stats">
      <div class="stat"><span>Compared</span><strong>${input.ticks.length}</strong></div>
      <div class="stat"><span>Low cash</span><strong class="cash">${
        Number.isFinite(cashLow) ? escapeHtml(formatRateNoteMoney(cashLow)) : '—'
      }</strong></div>
      <div class="stat"><span>High cash</span><strong class="cash">${
        cashHigh > 0 ? escapeHtml(formatRateNoteMoney(cashHigh)) : '—'
      }</strong></div>
    </div>
    <table>
      <thead><tr><th>Facility</th><th>Payer</th><th>Code</th><th>Published</th><th>vs Medicare</th><th>Place</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="foot">${escapeHtml(brand.name)} ${escapeHtml(brand.product)} · ${escapeHtml(brand.tagline)}
      Published hospital cash. Not a quote. Not insurance.</p>`,
  });
}

export function buildBookRateNoteHtml(input: BookRateNoteInput): string {
  const brand = input.brand ?? CASH_PAY_BRAND;
  const rows = input.clips
    .map((clip) => {
      const when = clip.clippedAt ? new Date(clip.clippedAt).toLocaleDateString() : '—';
      return `<tr>
        <td>${escapeHtml(clip.facilityName)}</td>
        <td>${escapeHtml(clip.paymentMethod || 'Unnamed payer')}</td>
        <td class="mono">${escapeHtml(clip.procedureCode)}</td>
        <td class="cash">${escapeHtml(formatRateNoteMoney(clip.rate))}</td>
        <td class="mono">${clip.cmsRelativity == null ? '—' : `${clip.cmsRelativity.toFixed(2)}×`}</td>
        <td>${escapeHtml([clip.queryStateName, clip.queryMsaName].filter(Boolean).join(' · '))}</td>
        <td class="mono">${escapeHtml(when)}</td>
      </tr>`;
    })
    .join('');

  const cmsRange =
    input.compile.cmsMin == null
      ? '—'
      : `${input.compile.cmsMin.toFixed(2)}–${input.compile.cmsMax?.toFixed(2)}×`;

  return wrapDocument({
    title: `Rate note · ${input.bookName} · ${brand.tagline}`,
    brand,
    body: `${mast(input.logoUrl, brand)}
    <h1>${escapeHtml(input.bookName)}</h1>
    <p class="meta">${escapeHtml(input.memberName || 'Member')}${
      input.postalCode ? ` · ZIP ${escapeHtml(input.postalCode)}` : ''
    } · ${escapeHtml(input.asOf)}</p>
    <div class="stats cols-4">
      <div class="stat"><span>This book</span><strong>${input.compile.clipCount}</strong></div>
      <div class="stat"><span>Cash</span><strong class="cash">${escapeHtml(formatRateNoteMoney(input.compile.cashTotal))}</strong></div>
      <div class="stat"><span>Vs page high</span><strong class="cash">${escapeHtml(formatRateNoteMoney(input.compile.vsSliceHigh))}</strong></div>
      <div class="stat"><span>vs Medicare</span><strong>${escapeHtml(cmsRange)}</strong></div>
    </div>
    <table>
      <thead><tr><th>Facility</th><th>Payer</th><th>Code</th><th>Published</th><th>vs Medicare</th><th>Metro</th><th>As of</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="foot">${escapeHtml(brand.name)} ${escapeHtml(brand.product)} · ${escapeHtml(brand.tagline)}
      Published hospital cash. Not a quote. Not insurance. Page high / median were stored when the tick was clipped.</p>`,
  });
}

export function openRateNoteWindow(html: string): boolean {
  if (typeof window === 'undefined') return false;
  const w = window.open('', '_blank', 'noopener,noreferrer,width=900,height=720');
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}
