'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
} from '@crm-eco/ui';
import { Plus, Trash2, Save, Printer, Loader2, ReceiptText } from 'lucide-react';
import {
  computeInvoiceTotals,
  lineItemAmount,
  formatUsd,
  emptyNeedInvoice,
  type NeedInvoice,
  type NeedInvoiceLineItem,
} from '@crm-eco/lib';
import { saveNeedInvoice } from '../../app/needs/[id]/invoice-actions';

interface NeedInvoiceCardProps {
  needId: string;
  invoice: NeedInvoice | null;
  /** When false, renders a read-only invoice (e.g. after the request is closed). */
  canEdit?: boolean;
}

function newLine(): NeedInvoiceLineItem {
  return {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `li-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    description: '',
    code: '',
    quantity: 1,
    unit_price: 0,
    amount: 0,
    source_attachment_id: null,
  };
}

export function NeedInvoiceCard({ needId, invoice, canEdit = true }: NeedInvoiceCardProps) {
  const [inv, setInv] = useState<NeedInvoice>(invoice ?? emptyNeedInvoice());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const totals = computeInvoiceTotals(inv);

  const updateLine = (id: string, updates: Partial<NeedInvoiceLineItem>) => {
    setInv((prev) => ({
      ...prev,
      line_items: prev.line_items.map((li) => {
        if (li.id !== id) return li;
        const next = { ...li, ...updates };
        // Recompute the amount from qty × price unless the amount itself was edited.
        if (updates.quantity !== undefined || updates.unit_price !== undefined) {
          next.amount = lineItemAmount(next.quantity, next.unit_price);
        }
        return next;
      }),
    }));
  };

  const addLine = () => setInv((prev) => ({ ...prev, line_items: [...prev.line_items, newLine()] }));
  const removeLine = (id: string) =>
    setInv((prev) => ({ ...prev, line_items: prev.line_items.filter((li) => li.id !== id) }));

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    const result = await saveNeedInvoice(needId, inv);
    setSaving(false);
    setMessage({ kind: result.success ? 'ok' : 'err', text: result.message });
  };

  return (
    <Card className="print:shadow-none print:border-0" data-invoice-card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ReceiptText className="w-5 h-5 text-blue-600" />
          Itemized Invoice
        </CardTitle>
        <CardDescription>
          {canEdit
            ? 'Break your receipt or bill into line items. This helps our team review your request faster.'
            : 'Line items for this request.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Line items table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-2 font-medium">Description</th>
                <th className="py-2 px-2 font-medium w-24">Code</th>
                <th className="py-2 px-2 font-medium w-16">Qty</th>
                <th className="py-2 px-2 font-medium w-28">Unit price</th>
                <th className="py-2 px-2 font-medium w-28 text-right">Amount</th>
                {canEdit && <th className="py-2 pl-2 w-10" aria-label="Remove" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inv.line_items.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 6 : 5} className="py-6 text-center text-slate-400">
                    No line items yet.{canEdit ? ' Add one below.' : ''}
                  </td>
                </tr>
              )}
              {inv.line_items.map((li) => (
                <tr key={li.id} className="align-top">
                  <td className="py-2 pr-2">
                    {canEdit ? (
                      <Input
                        value={li.description}
                        onChange={(e) => updateLine(li.id, { description: e.target.value })}
                        placeholder="Service or item"
                      />
                    ) : (
                      <span className="text-slate-900">{li.description || '—'}</span>
                    )}
                  </td>
                  <td className="py-2 px-2">
                    {canEdit ? (
                      <Input
                        value={li.code ?? ''}
                        onChange={(e) => updateLine(li.id, { code: e.target.value })}
                        placeholder="CPT"
                      />
                    ) : (
                      <span className="text-slate-600">{li.code || '—'}</span>
                    )}
                  </td>
                  <td className="py-2 px-2">
                    {canEdit ? (
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={li.quantity || ''}
                        onChange={(e) => updateLine(li.id, { quantity: parseFloat(e.target.value) || 0 })}
                      />
                    ) : (
                      <span className="text-slate-600">{li.quantity}</span>
                    )}
                  </td>
                  <td className="py-2 px-2">
                    {canEdit ? (
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={li.unit_price || ''}
                        onChange={(e) => updateLine(li.id, { unit_price: parseFloat(e.target.value) || 0 })}
                      />
                    ) : (
                      <span className="text-slate-600">{formatUsd(li.unit_price)}</span>
                    )}
                  </td>
                  <td className="py-2 px-2 text-right">
                    {canEdit ? (
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        className="text-right"
                        value={li.amount || ''}
                        onChange={(e) => updateLine(li.id, { amount: parseFloat(e.target.value) || 0 })}
                      />
                    ) : (
                      <span className="font-medium text-slate-900">{formatUsd(li.amount)}</span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="py-2 pl-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeLine(li.id)}
                        className="text-slate-400 hover:text-red-500"
                        aria-label="Remove line item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {canEdit && (
          <Button type="button" variant="outline" size="sm" onClick={addLine} className="print:hidden">
            <Plus className="w-4 h-4 mr-1" /> Add line item
          </Button>
        )}

        {/* Totals */}
        <div className="ml-auto w-full sm:w-72 space-y-1 pt-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Subtotal</span>
            <span className="font-medium text-slate-900">{formatUsd(totals.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500">Self-pay adjustment</span>
            {canEdit ? (
              <Input
                type="number"
                min="0"
                step="0.01"
                className="h-8 w-28 text-right"
                value={inv.self_pay_adjustment || ''}
                onChange={(e) =>
                  setInv((prev) => ({ ...prev, self_pay_adjustment: parseFloat(e.target.value) || 0 }))
                }
              />
            ) : (
              <span className="font-medium text-slate-900">−{formatUsd(totals.adjustment)}</span>
            )}
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-1 text-base">
            <span className="font-semibold text-slate-900">Total</span>
            <span className="font-bold text-slate-900">{formatUsd(totals.total)}</span>
          </div>
        </div>

        {message && (
          <p className={`text-sm ${message.kind === 'ok' ? 'text-green-700' : 'text-red-600'}`}>
            {message.text}
          </p>
        )}

        <div className="flex flex-wrap gap-3 pt-1 print:hidden">
          {canEdit && (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Invoice
            </Button>
          )}
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" /> Print / Save PDF
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
