'use client';

import { Download } from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { toast } from 'sonner';
import type { IdCardData } from '@/app/documents/actions';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Produces a real, downloadable ID card without a heavy PDF dependency: it opens
 * a self-contained, print-optimized HTML document in a new window and triggers
 * the browser print dialog, where the member can "Save as PDF". All values come
 * from the server action (tenant-true org name, real group/member number).
 */
export function IdCardDownloadButton({ idCard }: { idCard: IdCardData }) {
  const handleDownload = () => {
    const w = window.open('', '_blank', 'noopener,noreferrer,width=720,height=480');
    if (!w) {
      toast.error('Please allow pop-ups to download your ID card.');
      return;
    }
    const effective = idCard.effectiveDate
      ? new Date(idCard.effectiveDate).toLocaleDateString()
      : '—';
    const html = `<!doctype html><html><head><meta charset="utf-8" />
<title>${escapeHtml(idCard.orgName)} — Member ID Card</title>
<style>
  * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  body { margin: 0; padding: 32px; background: #f1f5f9; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .card { width: 600px; max-width: 100%; margin: 0 auto; border-radius: 16px; color: #fff;
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 55%, #4338ca 100%); padding: 28px 32px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }
  .eyebrow { font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: #bfdbfe; margin: 0 0 4px; }
  .org { font-size: 22px; font-weight: 700; margin: 0; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 24px; }
  .label { font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: #bfdbfe; margin: 0 0 2px; }
  .value { font-size: 16px; font-weight: 600; margin: 0; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .foot { border-top: 1px solid rgba(255,255,255,.3); padding-top: 14px; font-size: 12px; color: #dbeafe; }
  @media print { body { padding: 0; background: #fff; } .noprint { display: none; } }
  .noprint { text-align: center; margin-top: 20px; }
  button { padding: 8px 16px; border-radius: 8px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; }
</style></head>
<body>
  <div class="card">
    <div class="head">
      <div><p class="eyebrow">Health Sharing Member ID Card</p><p class="org">${escapeHtml(idCard.orgName)}</p></div>
    </div>
    <div class="grid">
      <div><p class="label">Member Name</p><p class="value">${escapeHtml(idCard.memberName)}</p></div>
      <div><p class="label">Member ID</p><p class="value mono">${escapeHtml(idCard.memberNumber)}</p></div>
      <div><p class="label">Plan</p><p class="value">${escapeHtml(idCard.planName)}</p></div>
      <div><p class="label">Effective Date</p><p class="value">${escapeHtml(effective)}</p></div>
    </div>
    <div class="foot">Group #: ${escapeHtml(idCard.groupNumber)}</div>
  </div>
  <div class="noprint"><button onclick="window.print()">Print / Save as PDF</button></div>
  <script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 300); });</script>
</body></html>`;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  return (
    <Button
      variant="secondary"
      size="sm"
      className="bg-white/20 hover:bg-white/30 text-white border-0"
      onClick={handleDownload}
    >
      <Download className="h-4 w-4 mr-2" />
      Download Card
    </Button>
  );
}
