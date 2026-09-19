import { describe, expect, it, vi } from 'vitest';
import { applyInvoicePayment } from '../invoice-service';

describe('applyInvoicePayment', () => {
  it('uses the atomic payment RPC and returns its invoice totals', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { amount_paid: 75, balance_due: 25, status: 'partial' },
      error: null,
    });
    const from = vi.fn();

    const result = await applyInvoicePayment({ rpc, from } as never, {
      organizationId: 'org-1',
      invoiceId: 'invoice-1',
      amount: 75,
      kind: 'payment',
      paymentMethod: 'check',
      referenceNumber: 'CHK-123',
      notes: 'Front desk payment',
      paymentDate: '2026-09-19',
    });

    expect(rpc).toHaveBeenCalledWith('apply_invoice_payment_tx', {
      p_organization_id: 'org-1',
      p_invoice_id: 'invoice-1',
      p_amount: 75,
      p_kind: 'payment',
      p_payment_method: 'check',
      p_reference_number: 'CHK-123',
      p_notes: 'Front desk payment',
      p_payment_date: '2026-09-19',
    });
    expect(from).not.toHaveBeenCalled();
    expect(result).toEqual({ amount_paid: 75, balance_due: 25, status: 'partial' });
  });

  it('surfaces an atomic RPC failure without attempting legacy partial writes', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'invoice update failed' },
    });
    const from = vi.fn();

    await expect(
      applyInvoicePayment({ rpc, from } as never, {
        organizationId: 'org-1',
        invoiceId: 'invoice-1',
        amount: 10,
        kind: 'credit',
      })
    ).rejects.toThrow('invoice update failed');

    expect(from).not.toHaveBeenCalled();
  });

  it('rejects non-positive amounts before calling the database', async () => {
    const rpc = vi.fn();

    await expect(
      applyInvoicePayment({ rpc } as never, {
        organizationId: 'org-1',
        invoiceId: 'invoice-1',
        amount: 0,
        kind: 'payment',
      })
    ).rejects.toThrow('Amount must be greater than zero');

    expect(rpc).not.toHaveBeenCalled();
  });
});
