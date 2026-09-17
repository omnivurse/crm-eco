import { describe, expect, it } from 'vitest';
import {
  applyInvoiceMoney,
  buildInvoiceHtml,
  cardExpiresOnOrBefore,
  computeBillingInvoiceTotals,
  DEFAULT_DUNNING_SCHEDULE,
  listExpiringCards,
  nextDunningStep,
  parseCardExpiration,
  parseDunningSchedule,
} from '../invoice-os';

describe('computeBillingInvoiceTotals', () => {
  it('sums lines and applies percent tax', () => {
    const totals = computeBillingInvoiceTotals({
      lines: [
        { quantity: 2, unit_price: 50 },
        { quantity: 1, unit_price: 25 },
      ],
      taxRate: 8,
    });
    expect(totals.subtotal).toBe(125);
    expect(totals.tax_amount).toBe(10);
    expect(totals.total).toBe(135);
    expect(totals.balance_due).toBe(135);
    expect(totals.status).toBe('draft');
  });

  it('treats missing tax as zero', () => {
    const totals = computeBillingInvoiceTotals({
      lines: [{ quantity: 1, unit_price: 99.995 }],
    });
    expect(totals.tax_amount).toBe(0);
    expect(totals.total).toBe(100);
  });
});

describe('applyInvoiceMoney', () => {
  it('records a partial payment', () => {
    const next = applyInvoiceMoney({
      total: 100,
      amountPaid: 0,
      application: 40,
      previousStatus: 'sent',
    });
    expect(next.amount_paid).toBe(40);
    expect(next.balance_due).toBe(60);
    expect(next.status).toBe('partial');
  });

  it('marks a credit that clears the balance as paid', () => {
    const next = applyInvoiceMoney({
      total: 80,
      amountPaid: 20,
      application: 60,
      previousStatus: 'partial',
    });
    expect(next.amount_paid).toBe(80);
    expect(next.balance_due).toBe(0);
    expect(next.status).toBe('paid');
  });
});

describe('dunning schedule', () => {
  it('falls back to 1/4/7/14', () => {
    expect(parseDunningSchedule(null)).toEqual([...DEFAULT_DUNNING_SCHEDULE]);
  });

  it('parses snake_case days_after_failure', () => {
    const schedule = parseDunningSchedule([
      { attempt: 2, days_after_failure: 5, template: 'second' },
      { attempt: 1, daysAfterFailure: 1 },
    ]);
    expect(schedule[0]).toMatchObject({ attempt: 1, daysAfterFailure: 1 });
    expect(schedule[1]).toMatchObject({ attempt: 2, daysAfterFailure: 5, template: 'second' });
  });

  it('returns the next attempt after the current retry', () => {
    expect(nextDunningStep([...DEFAULT_DUNNING_SCHEDULE], 0)?.attempt).toBe(1);
    expect(nextDunningStep([...DEFAULT_DUNNING_SCHEDULE], 3)?.template).toBe('payment_abandoned');
    expect(nextDunningStep([...DEFAULT_DUNNING_SCHEDULE], 4)).toBeNull();
  });
});

describe('card expiration', () => {
  it('parses MM/YY and MM/YYYY', () => {
    expect(parseCardExpiration('09/26')).toEqual({ year: 2026, month: 9 });
    expect(parseCardExpiration('9 / 2026')).toEqual({ year: 2026, month: 9 });
    expect(parseCardExpiration('13/26')).toBeNull();
  });

  it('flags cards that expire on or before the horizon', () => {
    expect(cardExpiresOnOrBefore('09/26', new Date('2026-09-30T23:59:59'))).toBe(true);
    expect(cardExpiresOnOrBefore('10/26', new Date('2026-09-13'))).toBe(false);
  });

  it('lists active cards expiring within the window', () => {
    const cards = listExpiringCards(
      [
        { id: 'a', expiration_date: '09/26', is_active: true },
        { id: 'b', expiration_date: '12/29', is_active: true },
        { id: 'c', expiration_date: '09/26', is_active: false },
      ],
      60,
      new Date('2026-09-13')
    );
    expect(cards.map((row) => row.id)).toEqual(['a']);
  });
});

describe('buildInvoiceHtml', () => {
  it('escapes user text and includes totals', () => {
    const html = buildInvoiceHtml({
      invoiceNumber: 'INV-1',
      orgName: 'PIFH',
      billTo: 'Ada <script>',
      lines: [{ name: 'Membership', quantity: 1, unit_price: 100, total: 100 }],
      totals: { subtotal: 100, tax_amount: 0, total: 100, amount_paid: 0, balance_due: 100 },
    });
    expect(html).toContain('INV-1');
    expect(html).toContain('$100.00');
    expect(html).toContain('Ada &lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
});
