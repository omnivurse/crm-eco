'use client';

import { FileText } from '@phosphor-icons/react';
import { toast } from 'sonner';
import type { RateBookCompile, RateClipSnapshot } from '@crm-eco/cash-pay';
import styles from './instrument.module.css';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

interface RateNoteButtonProps {
  bookName: string;
  memberName: string;
  postalCode: string;
  compile: RateBookCompile;
  clips: RateClipSnapshot[];
}

export function RateNoteButton({
  bookName,
  memberName,
  postalCode,
  compile,
  clips,
}: RateNoteButtonProps) {
  const handlePrint = () => {
    if (clips.length === 0) {
      toast.error('Clip a tick before printing a rate note.');
      return;
    }
    const w = window.open('', '_blank', 'noopener,noreferrer,width=900,height=720');
    if (!w) {
      toast.error('Allow pop-ups to print the rate note.');
      return;
    }
    const asOf = new Date().toLocaleDateString();
    const rows = clips
      .map((clip) => {
        const when = clip.clippedAt ? new Date(clip.clippedAt).toLocaleDateString() : '—';
        return `<tr>
          <td>${escapeHtml(clip.facilityName)}</td>
          <td class="mono">${escapeHtml(clip.procedureCode)}</td>
          <td>${escapeHtml(clip.codeDescription || clip.category || '')}</td>
          <td class="cash">${escapeHtml(money(clip.rate))}</td>
          <td class="mono">${clip.cmsRelativity == null ? '—' : `${clip.cmsRelativity.toFixed(2)}x`}</td>
          <td>${escapeHtml([clip.queryStateName, clip.queryMsaName].filter(Boolean).join(' · '))}</td>
          <td class="mono">${escapeHtml(when)}</td>
        </tr>`;
      })
      .join('');

    w.document.open();
    w.document.write(`<!doctype html><html><head><meta charset="utf-8" />
<title>Rate note · ${escapeHtml(bookName)}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 28px; background: #f6fafb; color: #0b1220;
    font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; }
  .sheet { max-width: 760px; margin: 0 auto; background: #fff; border: 1px solid #d7e0e4; padding: 28px 30px; }
  .kicker { margin: 0 0 6px; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #64748b; }
  h1 { margin: 0 0 4px; font-size: 22px; letter-spacing: -0.03em; }
  .meta { margin: 0 0 18px; font-size: 13px; color: #64748b; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 0 0 18px; }
  .stat { padding: 10px 12px; background: #f6fafb; border: 1px solid #e4ecef; }
  .stat span { display: block; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: #64748b; }
  .stat strong { display: block; margin-top: 4px; font-family: ui-monospace, Menlo, monospace; font-size: 16px; }
  .cash { color: #d97706; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: #64748b;
    border-bottom: 1px solid #d7e0e4; padding: 6px 6px 8px; }
  td { padding: 8px 6px; border-bottom: 1px solid #eef2f4; vertical-align: top; }
  .mono { font-family: ui-monospace, Menlo, monospace; }
  .foot { margin-top: 18px; font-size: 12px; color: #64748b; }
  .noprint { text-align: center; margin-top: 16px; }
  button { min-height: 40px; padding: 0 14px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; }
  @media print { body { background: #fff; padding: 0; } .noprint { display: none; } .sheet { border: 0; } }
</style></head>
<body>
  <div class="sheet">
    <p class="kicker">Rate note</p>
    <h1>${escapeHtml(bookName)}</h1>
    <p class="meta">${escapeHtml(memberName || 'Member')}${postalCode ? ` · ZIP ${escapeHtml(postalCode)}` : ''} · ${escapeHtml(asOf)}</p>
    <div class="stats">
      <div class="stat"><span>This book</span><strong>${compile.clipCount}</strong></div>
      <div class="stat"><span>Cash</span><strong class="cash">${escapeHtml(money(compile.cashTotal))}</strong></div>
      <div class="stat"><span>Vs page high</span><strong class="cash">${escapeHtml(money(compile.vsSliceHigh))}</strong></div>
      <div class="stat"><span>CMS needle</span><strong>${
        compile.cmsMin == null ? '—' : `${compile.cmsMin.toFixed(2)}–${compile.cmsMax?.toFixed(2)}x`
      }</strong></div>
    </div>
    <table>
      <thead><tr><th>Facility</th><th>Code</th><th>Description</th><th>Cash</th><th>CMS</th><th>Metro</th><th>As of</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="foot">Published hospital cash. Not a quote. Not insurance. Page high / median were stored when the tick was clipped.</p>
  </div>
  <div class="noprint"><button onclick="window.print()">Print / Save as PDF</button></div>
  <script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 300); });</script>
</body></html>`);
    w.document.close();
  };

  return (
    <button type="button" className={styles.ghostBtn} onClick={handlePrint}>
      <FileText weight="light" className="mr-2 h-4 w-4" aria-hidden />
      Rate note
    </button>
  );
}
