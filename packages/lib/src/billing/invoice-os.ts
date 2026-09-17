export const DEFAULT_DUNNING_SCHEDULE = [
  { attempt: 1, daysAfterFailure: 1, template: 'payment_failed_attempt_1' },
  { attempt: 2, daysAfterFailure: 4, template: 'payment_failed_attempt_2' },
  { attempt: 3, daysAfterFailure: 7, template: 'payment_failed_attempt_3' },
  { attempt: 4, daysAfterFailure: 14, template: 'payment_abandoned' },
] as const;

export interface InvoiceLineInput {
  name: string;
  description?: string | null;
  quantity: number;
  unit_price: number;
  product_id?: string | null;
}

export interface InvoiceTotals {
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  status: 'draft' | 'sent' | 'partial' | 'paid';
}

export interface DunningStep {
  attempt: number;
  daysAfterFailure: number;
  template: string;
}

export function roundMoney(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function computeBillingInvoiceTotals(input: {
  lines: Array<{ quantity: number; unit_price: number }>;
  taxRate?: number | null;
  amountPaid?: number | null;
}): InvoiceTotals {
  const subtotal = roundMoney(
    input.lines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unit_price), 0)
  );
  const tax_rate = Number(input.taxRate) || 0;
  const tax_amount = roundMoney(subtotal * (tax_rate / 100));
  const total = roundMoney(subtotal + tax_amount);
  const amount_paid = roundMoney(Math.max(0, Number(input.amountPaid) || 0));
  const balance_due = roundMoney(Math.max(0, total - amount_paid));
  return {
    subtotal,
    tax_rate,
    tax_amount,
    total,
    amount_paid,
    balance_due,
    status: invoiceStatusFromBalance(total, amount_paid),
  };
}

export function invoiceStatusFromBalance(total: number, amountPaid: number): InvoiceTotals['status'] {
  if (amountPaid <= 0) return 'draft';
  if (amountPaid >= total && total > 0) return 'paid';
  return 'partial';
}

export function applyInvoiceMoney(input: {
  total: number;
  amountPaid: number;
  application: number;
  previousStatus?: string | null;
}): { amount_paid: number; balance_due: number; status: string } {
  const delta = roundMoney(Math.abs(input.application));
  const amount_paid = roundMoney(Math.max(0, input.amountPaid + delta));
  const balance_due = roundMoney(Math.max(0, input.total - amount_paid));
  let status = input.previousStatus || 'sent';
  if (amount_paid >= input.total && input.total > 0) status = 'paid';
  else if (amount_paid > 0) status = 'partial';
  return { amount_paid, balance_due, status };
}

export function parseDunningSchedule(value: unknown): DunningStep[] {
  if (!Array.isArray(value) || value.length === 0) {
    return DEFAULT_DUNNING_SCHEDULE.map((step) => ({ ...step }));
  }
  const parsed = value
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const rec = row as Record<string, unknown>;
      const attempt = Number(rec.attempt);
      const daysAfterFailure = Number(rec.daysAfterFailure ?? rec.days_after_failure);
      if (!Number.isFinite(attempt) || !Number.isFinite(daysAfterFailure)) return null;
      return {
        attempt,
        daysAfterFailure,
        template: typeof rec.template === 'string' ? rec.template : `payment_failed_attempt_${attempt}`,
      };
    })
    .filter((row): row is DunningStep => row != null)
    .sort((a, b) => a.attempt - b.attempt);
  return parsed.length ? parsed : DEFAULT_DUNNING_SCHEDULE.map((step) => ({ ...step }));
}

export function nextDunningStep(
  schedule: DunningStep[],
  retryAttempt: number
): DunningStep | null {
  return schedule.find((step) => step.attempt === retryAttempt + 1) ?? null;
}

export function parseCardExpiration(value: string | null | undefined): { year: number; month: number } | null {
  const raw = (value ?? '').trim();
  const match = raw.match(/^(\d{1,2})\s*\/\s*(\d{2}|\d{4})$/);
  if (!match) return null;
  const month = Number(match[1]);
  let year = Number(match[2]);
  if (year < 100) year += 2000;
  if (month < 1 || month > 12) return null;
  return { year, month };
}

export function cardExpiresOnOrBefore(
  expiration: string | null | undefined,
  horizon: Date
): boolean {
  const parsed = parseCardExpiration(expiration);
  if (!parsed) return false;
  const lastDay = new Date(parsed.year, parsed.month, 0, 23, 59, 59);
  return lastDay.getTime() <= horizon.getTime();
}

export function listExpiringCards<T extends { expiration_date?: string | null; is_active?: boolean | null }>(
  profiles: T[],
  withinDays: number,
  asOf = new Date()
): T[] {
  const horizon = new Date(asOf);
  horizon.setDate(horizon.getDate() + withinDays);
  return profiles.filter((profile) => {
    if (profile.is_active === false) return false;
    return cardExpiresOnOrBefore(profile.expiration_date, horizon);
  });
}

export function buildInvoiceHtml(input: {
  invoiceNumber: string;
  title?: string | null;
  orgName: string;
  billTo: string;
  period?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  lines: Array<{ name: string; quantity: number; unit_price: number; total?: number }>;
  totals: Pick<InvoiceTotals, 'subtotal' | 'tax_amount' | 'total' | 'amount_paid' | 'balance_due'>;
}): string {
  const rows = input.lines
    .map((line) => {
      const lineTotal = line.total ?? roundMoney(line.quantity * line.unit_price);
      return `<tr><td>${escapeHtml(line.name)}</td><td>${line.quantity}</td><td>${money(line.unit_price)}</td><td>${money(lineTotal)}</td></tr>`;
    })
    .join('');
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(input.invoiceNumber)}</title>
<style>body{font-family:ui-sans-serif,system-ui,sans-serif;color:#0f172a;margin:32px}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #e2e8f0;padding:8px;text-align:left}h1{margin:0 0 4px}.muted{color:#64748b}</style>
</head><body>
<h1>${escapeHtml(input.orgName)}</h1>
<p class="muted">${escapeHtml(input.title || 'Invoice')} ${escapeHtml(input.invoiceNumber)}</p>
<p>Bill to: ${escapeHtml(input.billTo)}</p>
${input.period ? `<p>Period: ${escapeHtml(input.period)}</p>` : ''}
${input.dueDate ? `<p>Due: ${escapeHtml(input.dueDate)}</p>` : ''}
<table><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>
<p>Subtotal ${money(input.totals.subtotal)} · Tax ${money(input.totals.tax_amount)} · Total ${money(input.totals.total)}</p>
<p>Paid ${money(input.totals.amount_paid)} · Balance ${money(input.totals.balance_due)}</p>
${input.notes ? `<p>${escapeHtml(input.notes)}</p>` : ''}
</body></html>`;
}

function money(n: number): string {
  return `$${roundMoney(n).toFixed(2)}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
