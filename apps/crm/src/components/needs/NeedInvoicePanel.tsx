'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase-client';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui/components/card';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Plus, Trash2, Save, Printer, Loader2, ReceiptText } from 'lucide-react';
import {
  computeInvoiceTotals,
  lineItemAmount,
  formatUsd,
  emptyNeedInvoice,
  parseNeedInvoice,
  type NeedInvoice,
  type NeedInvoiceLineItem,
} from '@crm-eco/lib';

/**
 * Team-facing itemized invoice for a member's Need ("Sharing Request").
 *
 * Self-contained: reads/writes the real `needs` table by id (RLS scopes to the
 * caller's org), independent of the surrounding page. When the id is not a real
 * member need (e.g. the demo detail view), it renders nothing.
 */
export function NeedInvoicePanel({ needId }: { needId: string }) {
  const [loading, setLoading] = useState(true);
  const [exists, setExists] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [inv, setInv] = useState<NeedInvoice>(emptyNeedInvoice());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('needs')
        .select('id, organization_id, custom_fields')
        .eq('id', needId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setExists(false);
      } else {
        setExists(true);
        setOrgId((data as { organization_id?: string }).organization_id ?? null);
        setInv(parseNeedInvoice((data as { custom_fields?: unknown }).custom_fields));
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [needId]);

  const totals = computeInvoiceTotals(inv);

  const updateLine = useCallback((id: string, updates: Partial<NeedInvoiceLineItem>) => {
    setInv((prev) => ({
      ...prev,
      line_items: prev.line_items.map((li) => {
        if (li.id !== id) return li;
        const next = { ...li, ...updates };
        if (updates.quantity !== undefined || updates.unit_price !== undefined) {
          next.amount = lineItemAmount(next.quantity, next.unit_price);
        }
        return next;
      }),
    }));
  }, []);

  const addLine = () =>
    setInv((prev) => ({
      ...prev,
      line_items: [
        ...prev.line_items,
        {
          id:
            typeof crypto !== 'undefined' && 'randomUUID' in crypto
              ? crypto.randomUUID()
              : `li-${Date.now()}`,
          description: '',
          code: '',
          quantity: 1,
          unit_price: 0,
          amount: 0,
          source_attachment_id: null,
        },
      ],
    }));

  const removeLine = (id: string) =>
    setInv((prev) => ({ ...prev, line_items: prev.line_items.filter((li) => li.id !== id) }));

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    // Read-modify-write custom_fields so we don't clobber the share-request data.
    const { data: current } = await supabase
      .from('needs')
      .select('custom_fields')
      .eq('id', needId)
      .maybeSingle();
    const existingCustom =
      current && typeof (current as { custom_fields?: unknown }).custom_fields === 'object'
        ? ((current as { custom_fields?: Record<string, unknown> }).custom_fields as Record<string, unknown>)
        : {};

    const cleanInvoice: NeedInvoice = {
      line_items: inv.line_items.map((li) => ({
        ...li,
        amount:
          li.amount !== undefined && li.amount !== null
            ? li.amount
            : lineItemAmount(li.quantity, li.unit_price),
      })),
      self_pay_adjustment: Math.max(0, Number(inv.self_pay_adjustment) || 0),
      notes: inv.notes || '',
      updated_at: new Date().toISOString(),
    };

    const update: Record<string, unknown> = {
      custom_fields: { ...existingCustom, invoice: cleanInvoice },
      updated_at: new Date().toISOString(),
    };
    if (totals.subtotal > 0) update.billed_amount = totals.subtotal;

    const { error } = await supabase.from('needs').update(update).eq('id', needId);
    if (error) {
      setSaving(false);
      setMessage({ kind: 'err', text: 'Failed to save the invoice.' });
      return;
    }

    // need_events.organization_id is NOT NULL and RLS-checked — include it, and
    // skip the (best-effort) audit insert if we somehow don't have it.
    if (orgId) {
      await supabase.from('need_events').insert({
        need_id: needId,
        organization_id: orgId,
        event_type: 'invoice_updated',
        description: `Invoice updated by staff (${cleanInvoice.line_items.length} line items)`,
      });
    }

    setSaving(false);
    setMessage({ kind: 'ok', text: 'Invoice saved.' });
  };

  if (loading) return null;
  if (!exists) return null; // Not a real member need (e.g. demo view) — nothing to itemize.

  return (
    <Card data-invoice-panel>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ReceiptText className="w-5 h-5 text-teal-600" />
          Itemized Invoice
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/10 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-2 font-medium">Description</th>
                <th className="py-2 px-2 font-medium w-24">Code</th>
                <th className="py-2 px-2 font-medium w-16">Qty</th>
                <th className="py-2 px-2 font-medium w-28">Unit price</th>
                <th className="py-2 px-2 font-medium w-28 text-right">Amount</th>
                <th className="py-2 pl-2 w-10" aria-label="Remove" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {inv.line_items.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    No line items yet. Add one below.
                  </td>
                </tr>
              )}
              {inv.line_items.map((li) => (
                <tr key={li.id} className="align-top">
                  <td className="py-2 pr-2">
                    <Input
                      value={li.description}
                      onChange={(e) => updateLine(li.id, { description: e.target.value })}
                      placeholder="Service or item"
                    />
                  </td>
                  <td className="py-2 px-2">
                    <Input
                      value={li.code ?? ''}
                      onChange={(e) => updateLine(li.id, { code: e.target.value })}
                      placeholder="CPT"
                    />
                  </td>
                  <td className="py-2 px-2">
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={li.quantity || ''}
                      onChange={(e) => updateLine(li.id, { quantity: parseFloat(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="py-2 px-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={li.unit_price || ''}
                      onChange={(e) => updateLine(li.id, { unit_price: parseFloat(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="py-2 px-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="text-right"
                      value={li.amount || ''}
                      onChange={(e) => updateLine(li.id, { amount: parseFloat(e.target.value) || 0 })}
                    />
                  </td>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Button type="button" variant="outline" size="sm" onClick={addLine} className="print:hidden">
          <Plus className="w-4 h-4 mr-1" /> Add line item
        </Button>

        <div className="ml-auto w-full sm:w-72 space-y-1 pt-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Subtotal</span>
            <span className="font-medium">{formatUsd(totals.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500">Self-pay adjustment</span>
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
          </div>
          <div className="flex justify-between border-t border-slate-200 dark:border-white/10 pt-1 text-base">
            <span className="font-semibold">Total</span>
            <span className="font-bold">{formatUsd(totals.total)}</span>
          </div>
        </div>

        {message && (
          <p className={`text-sm ${message.kind === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>
            {message.text}
          </p>
        )}

        <div className="flex flex-wrap gap-3 pt-1 print:hidden">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Invoice
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" /> Print / Save PDF
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
