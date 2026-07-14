/**
 * Itemized invoice for a Need ("Sharing Request").
 *
 * Stored on `needs.custom_fields.invoice` (JSONB — no schema migration). Members
 * itemize their receipts/bills into line items; the team reviews the rendered
 * invoice. Pure, dependency-free so it can be shared by the member portal and
 * the CRM.
 */

export interface NeedInvoiceLineItem {
  id: string;
  /** What the line is for (e.g. "Office visit", "CBC panel"). */
  description: string;
  /** Optional billing / CPT / procedure code. */
  code?: string | null;
  quantity: number;
  /** Per-unit price in dollars. */
  unit_price: number;
  /** Line total in dollars (quantity × unit_price, but overridable). */
  amount: number;
  /** Optional link back to the receipt/bill this came from. */
  source_attachment_id?: string | null;
}

export interface NeedInvoice {
  line_items: NeedInvoiceLineItem[];
  /** Self-pay discount / adjustment (>= 0) subtracted from the subtotal. */
  self_pay_adjustment: number;
  notes: string;
  /** ISO timestamp of the last edit (set by the caller when saving). */
  updated_at?: string | null;
}

export interface NeedInvoiceTotals {
  subtotal: number;
  adjustment: number;
  total: number;
}

const toNumber = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};

/** Round to cents to avoid floating-point drift in displayed totals. */
export const roundCents = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Line amount from quantity × unit price (rounded to cents). */
export function lineItemAmount(quantity: number, unitPrice: number): number {
  return roundCents(toNumber(quantity) * toNumber(unitPrice));
}

export function emptyNeedInvoice(): NeedInvoice {
  return { line_items: [], self_pay_adjustment: 0, notes: '' };
}

/** Subtotal, adjustment, and total for an invoice (all rounded to cents). */
export function computeInvoiceTotals(invoice: NeedInvoice | null | undefined): NeedInvoiceTotals {
  const items = invoice?.line_items ?? [];
  const subtotal = roundCents(items.reduce((sum, li) => sum + toNumber(li.amount), 0));
  const adjustment = roundCents(Math.max(0, toNumber(invoice?.self_pay_adjustment)));
  const total = roundCents(Math.max(0, subtotal - adjustment));
  return { subtotal, adjustment, total };
}

/**
 * Safely read a `NeedInvoice` out of a need's `custom_fields` JSONB, coercing
 * types and dropping malformed rows. Always returns a valid (possibly empty)
 * invoice so callers never have to null-check.
 */
export function parseNeedInvoice(customFields: unknown): NeedInvoice {
  const cf =
    customFields && typeof customFields === 'object' && !Array.isArray(customFields)
      ? (customFields as Record<string, unknown>)
      : {};
  const raw = cf.invoice;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyNeedInvoice();
  const obj = raw as Record<string, unknown>;

  const rawItems = Array.isArray(obj.line_items) ? obj.line_items : [];
  const line_items: NeedInvoiceLineItem[] = rawItems
    .filter((li): li is Record<string, unknown> => !!li && typeof li === 'object')
    .map((li, idx) => {
      const quantity = toNumber(li.quantity) || 0;
      const unit_price = toNumber(li.unit_price);
      const amount = li.amount !== undefined ? toNumber(li.amount) : lineItemAmount(quantity, unit_price);
      return {
        id: typeof li.id === 'string' && li.id ? li.id : `li-${idx}`,
        description: typeof li.description === 'string' ? li.description : '',
        code: typeof li.code === 'string' ? li.code : null,
        quantity,
        unit_price,
        amount,
        source_attachment_id:
          typeof li.source_attachment_id === 'string' ? li.source_attachment_id : null,
      };
    });

  return {
    line_items,
    self_pay_adjustment: Math.max(0, toNumber(obj.self_pay_adjustment)),
    notes: typeof obj.notes === 'string' ? obj.notes : '',
    updated_at: typeof obj.updated_at === 'string' ? obj.updated_at : null,
  };
}

/** True when the invoice has no line items and no adjustment/notes. */
export function isNeedInvoiceEmpty(invoice: NeedInvoice | null | undefined): boolean {
  if (!invoice) return true;
  return (
    invoice.line_items.length === 0 &&
    !invoice.self_pay_adjustment &&
    !(invoice.notes && invoice.notes.trim())
  );
}

/** Format a dollar amount as USD currency. */
export function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    toNumber(amount),
  );
}
