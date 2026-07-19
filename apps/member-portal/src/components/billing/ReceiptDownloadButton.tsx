'use client';

import { Download } from '@phosphor-icons/react';
import { Button } from '@crm-eco/ui/components/button';
import { toast } from 'sonner';

export interface ReceiptData {
  id: string;
  description: string | null;
  amount: number;
  paidAt: string | null;
  createdAt: string;
  status: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Produces a real, printable/saveable payment receipt without a PDF dependency,
 * using the same new-window + browser-print approach as the ID card. All values
 * come from the member's actual transaction row.
 */
export function ReceiptDownloadButton({ receipt }: { receipt: ReceiptData }) {
  const handleDownload = () => {
    const w = window.open('', '_blank', 'noopener,noreferrer,width=720,height=900');
    if (!w) {
      toast.error('Please allow pop-ups to download your receipt.');
      return;
    }
    const dateStr = receipt.paidAt
      ? new Date(receipt.paidAt).toLocaleDateString()
      : new Date(receipt.createdAt).toLocaleDateString();
    const html = `<!doctype html><html><head><meta charset="utf-8" />
<title>Payment Receipt</title>
<style>
  * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  body { margin: 0; padding: 40px; color: #0f172a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .wrap { max-width: 560px; margin: 0 auto; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .sub { color: #64748b; margin: 0 0 24px; font-size: 13px; }
  .row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e2e8f0; }
  .row .k { color: #64748b; }
  .row .v { font-weight: 600; text-align: right; }
  .total { display: flex; justify-content: space-between; padding: 16px 0; margin-top: 8px; font-size: 18px; font-weight: 700; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 999px; background: #dcfce7; color: #166534; font-size: 12px; font-weight: 600; }
  @media print { body { padding: 0; } .noprint { display: none; } }
  .noprint { margin-top: 24px; }
  button { padding: 8px 16px; border-radius: 8px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; }
</style></head>
<body><div class="wrap">
  <h1>Payment Receipt</h1>
  <p class="sub">Receipt #${escapeHtml(receipt.id)}</p>
  <div class="row"><span class="k">Description</span><span class="v">${escapeHtml(receipt.description || 'Monthly Share')}</span></div>
  <div class="row"><span class="k">Date</span><span class="v">${escapeHtml(dateStr)}</span></div>
  <div class="row"><span class="k">Status</span><span class="v"><span class="badge">${escapeHtml(receipt.status)}</span></span></div>
  <div class="total"><span>Amount</span><span>$${receipt.amount.toFixed(2)}</span></div>
  <div class="noprint"><button onclick="window.print()">Print / Save as PDF</button></div>
</div>
<script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 300); });</script>
</body></html>`;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  return (
    <Button variant="ghost" size="icon" className="h-11 w-11" title="Download Receipt" onClick={handleDownload}>
      <Download weight="light" className="h-4 w-4" />
    </Button>
  );
}
