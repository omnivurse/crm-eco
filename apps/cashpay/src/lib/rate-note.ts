import { brand } from './brand';
import { formatCash, formatNeedle } from './format';

export type RateNoteTick = {
  facilityName: string;
  payer: string;
  procedureCode: string;
  rate: number;
  cmsRelativity: number | null;
  cmsRate: number | null;
  city?: string | null;
  state?: string | null;
};

export type RateNoteInput = {
  ticks: RateNoteTick[];
  metro: string;
  procedureCode: string;
  asOf: string;
  logoUrl: string;
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildRateNoteHtml(input: RateNoteInput): string {
  const rows = input.ticks
    .map((tick) => {
      const place = [tick.city, tick.state].filter(Boolean).join(', ');
      return `<tr>
        <td>${escapeHtml(tick.facilityName)}</td>
        <td>${escapeHtml(tick.payer)}</td>
        <td class="mono">${escapeHtml(tick.procedureCode)}</td>
        <td class="cash">${escapeHtml(formatCash(tick.rate))}</td>
        <td class="mono">${escapeHtml(formatNeedle(tick.cmsRelativity) || '—')}</td>
        <td>${escapeHtml(place || '—')}</td>
      </tr>`;
    })
    .join('');

  const cashLow = input.ticks.reduce((min, tick) => Math.min(min, tick.rate), Number.POSITIVE_INFINITY);
  const cashHigh = input.ticks.reduce((max, tick) => Math.max(max, tick.rate), 0);

  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<title>${escapeHtml(brand.product)} rate note · ${escapeHtml(brand.tagline)}</title>
<style>
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
  }
</style></head>
<body>
  <div class="sheet">
    <div class="mast">
      <img src="${escapeHtml(input.logoUrl)}" alt="${escapeHtml(brand.name)}" />
      <p class="tagline">${escapeHtml(brand.tagline)}</p>
    </div>
    <p class="kicker">${escapeHtml(brand.advocate)}</p>
    <h1>Rate note</h1>
    <p class="meta">${escapeHtml(input.metro || 'No metro selected')}${
      input.procedureCode ? ` · CPT ${escapeHtml(input.procedureCode)}` : ''
    } · ${escapeHtml(input.asOf)}</p>
    <div class="stats">
      <div class="stat"><span>Compared</span><strong>${input.ticks.length}</strong></div>
      <div class="stat"><span>Low cash</span><strong class="cash">${
        Number.isFinite(cashLow) ? escapeHtml(formatCash(cashLow)) : '—'
      }</strong></div>
      <div class="stat"><span>High cash</span><strong class="cash">${
        cashHigh > 0 ? escapeHtml(formatCash(cashHigh)) : '—'
      }</strong></div>
    </div>
    <table>
      <thead><tr><th>Facility</th><th>Payer</th><th>Code</th><th>Published</th><th>vs Medicare</th><th>Place</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="foot">${escapeHtml(brand.name)} ${escapeHtml(brand.product)} · ${escapeHtml(brand.tagline)}
      Published hospital cash. Not a quote. Not insurance.</p>
  </div>
  <div class="noprint"><button type="button" onclick="window.print()">Print / Save as PDF</button></div>
  <script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 300); });</script>
</body></html>`;
}

export function openRateNote(input: Omit<RateNoteInput, 'asOf' | 'logoUrl'> & { logoUrl?: string }): boolean {
  if (input.ticks.length === 0 || typeof window === 'undefined') return false;
  const w = window.open('', '_blank', 'noopener,noreferrer,width=900,height=720');
  if (!w) return false;
  const logoUrl = input.logoUrl || new URL(brand.logo, window.location.origin).href;
  w.document.open();
  w.document.write(
    buildRateNoteHtml({
      ...input,
      logoUrl,
      asOf: new Date().toLocaleDateString(),
    }),
  );
  w.document.close();
  return true;
}
