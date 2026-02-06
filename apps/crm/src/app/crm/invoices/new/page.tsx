'use client';

/**
 * Invoice Builder Page
 *
 * Full-featured invoice creation with:
 * - Client/contact lookup
 * - Editable line items with quantity, rate, tax
 * - Auto-calculated subtotal, tax, discount, total
 * - Payment terms, due date, notes
 * - Save as draft or send
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Receipt,
  Send,
  Save,
  Eye,
  EyeOff,
  Calendar,
  DollarSign,
  Percent,
  GripVertical,
  Copy,
  FileText,
  Building2,
  User,
  Mail,
  Phone,
  Search,
  Loader2,
  Check,
  X,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Badge } from '@crm-eco/ui/components/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';
import { toast } from 'sonner';
import { createClient } from '@crm-eco/lib/supabase/client';

// ============================================================================
// Types
// ============================================================================

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  taxRate: number;
  amount: number;
}

interface ClientInfo {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  address?: string;
}

type PaymentTerms = 'due_on_receipt' | 'net_15' | 'net_30' | 'net_45' | 'net_60' | 'custom';

const PAYMENT_TERMS_LABELS: Record<PaymentTerms, string> = {
  due_on_receipt: 'Due on Receipt',
  net_15: 'Net 15',
  net_30: 'Net 30',
  net_45: 'Net 45',
  net_60: 'Net 60',
  custom: 'Custom Date',
};

// ============================================================================
// Helpers
// ============================================================================

function generateInvoiceNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
  return `INV-${year}${month}-${rand}`;
}

function generateId(): string {
  return `item_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function calculateDueDate(terms: PaymentTerms, issueDate: string): string {
  const date = new Date(issueDate);
  switch (terms) {
    case 'due_on_receipt':
      return issueDate;
    case 'net_15':
      date.setDate(date.getDate() + 15);
      return date.toISOString().split('T')[0];
    case 'net_30':
      date.setDate(date.getDate() + 30);
      return date.toISOString().split('T')[0];
    case 'net_45':
      date.setDate(date.getDate() + 45);
      return date.toISOString().split('T')[0];
    case 'net_60':
      date.setDate(date.getDate() + 60);
      return date.toISOString().split('T')[0];
    default:
      return issueDate;
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

// ============================================================================
// Line Item Row Component
// ============================================================================

function LineItemRow({
  item,
  index,
  onUpdate,
  onRemove,
  onDuplicate,
  canRemove,
}: {
  item: LineItem;
  index: number;
  onUpdate: (id: string, field: keyof LineItem, value: string | number) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  canRemove: boolean;
}) {
  return (
    <div className="group grid grid-cols-12 gap-3 items-start py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
      {/* Grip handle */}
      <div className="col-span-1 flex items-center justify-center pt-2">
        <span className="text-xs text-slate-400 font-medium w-6 text-center">{index + 1}</span>
      </div>

      {/* Description */}
      <div className="col-span-4">
        <Input
          value={item.description}
          onChange={(e) => onUpdate(item.id, 'description', e.target.value)}
          placeholder="Item description"
          className="text-sm"
        />
      </div>

      {/* Quantity */}
      <div className="col-span-1">
        <Input
          type="number"
          min={0}
          step={1}
          value={item.quantity || ''}
          onChange={(e) => onUpdate(item.id, 'quantity', parseFloat(e.target.value) || 0)}
          placeholder="Qty"
          className="text-sm text-right"
        />
      </div>

      {/* Rate */}
      <div className="col-span-2">
        <div className="relative">
          <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input
            type="number"
            min={0}
            step={0.01}
            value={item.rate || ''}
            onChange={(e) => onUpdate(item.id, 'rate', parseFloat(e.target.value) || 0)}
            placeholder="0.00"
            className="text-sm text-right pl-7"
          />
        </div>
      </div>

      {/* Tax */}
      <div className="col-span-1">
        <div className="relative">
          <Input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={item.taxRate || ''}
            onChange={(e) => onUpdate(item.id, 'taxRate', parseFloat(e.target.value) || 0)}
            placeholder="0"
            className="text-sm text-right pr-6"
          />
          <Percent className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
        </div>
      </div>

      {/* Amount */}
      <div className="col-span-2 flex items-center justify-between pt-2">
        <span className="text-sm font-medium text-slate-900 dark:text-white">
          {formatCurrency(item.amount)}
        </span>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => onDuplicate(item.id)}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
            title="Duplicate"
          >
            <Copy className="w-3.5 h-3.5 text-slate-400" />
          </button>
          {canRemove && (
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              className="p-1 hover:bg-red-50 dark:hover:bg-red-500/10 rounded"
              title="Remove"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Invoice Builder
// ============================================================================

export default function NewInvoicePage() {
  const router = useRouter();
  const supabase = createClient();

  // Invoice metadata
  const [invoiceNumber, setInvoiceNumber] = useState(generateInvoiceNumber);
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms>('net_30');
  const [dueDate, setDueDate] = useState(() => calculateDueDate('net_30', new Date().toISOString().split('T')[0]));
  const [currency] = useState('USD');

  // Client
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<ClientInfo[]>([]);
  const [searchingClients, setSearchingClients] = useState(false);
  const [showClientSearch, setShowClientSearch] = useState(false);

  // Line items
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: generateId(), description: '', quantity: 1, rate: 0, taxRate: 0, amount: 0 },
  ]);

  // Discount
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState(0);

  // Notes
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('Payment is due within the specified terms. Late payments may be subject to a 1.5% monthly interest charge.');

  // UI state
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // ========================================================================
  // Auto-calculate amounts
  // ========================================================================

  const updateLineItemAmount = useCallback((items: LineItem[]): LineItem[] => {
    return items.map((item) => ({
      ...item,
      amount: item.quantity * item.rate,
    }));
  }, []);

  // Recalculate on payment terms change
  useEffect(() => {
    if (paymentTerms !== 'custom') {
      setDueDate(calculateDueDate(paymentTerms, issueDate));
    }
  }, [paymentTerms, issueDate]);

  // ========================================================================
  // Calculations
  // ========================================================================

  const calculations = useMemo(() => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.rate, 0);
    const taxTotal = lineItems.reduce(
      (sum, item) => sum + item.quantity * item.rate * (item.taxRate / 100),
      0
    );
    const discountAmount =
      discountType === 'percent' ? subtotal * (discountValue / 100) : discountValue;
    const total = subtotal + taxTotal - discountAmount;

    return { subtotal, taxTotal, discountAmount, total };
  }, [lineItems, discountType, discountValue]);

  // ========================================================================
  // Line item actions
  // ========================================================================

  function handleUpdateLineItem(id: string, field: keyof LineItem, value: string | number) {
    setLineItems((prev) => {
      const updated = prev.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      );
      return updateLineItemAmount(updated);
    });
  }

  function handleAddLineItem() {
    setLineItems((prev) => [
      ...prev,
      { id: generateId(), description: '', quantity: 1, rate: 0, taxRate: 0, amount: 0 },
    ]);
  }

  function handleRemoveLineItem(id: string) {
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  }

  function handleDuplicateLineItem(id: string) {
    setLineItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (!item) return prev;
      const idx = prev.indexOf(item);
      const duplicate = { ...item, id: generateId() };
      const next = [...prev];
      next.splice(idx + 1, 0, duplicate);
      return next;
    });
  }

  // ========================================================================
  // Client search
  // ========================================================================

  useEffect(() => {
    if (!clientSearch || clientSearch.length < 2) {
      setClientResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingClients(true);
      try {
        const { data: records } = await supabase
          .from('crm_records')
          .select('id, title, email, phone, data')
          .or(`title.ilike.%${clientSearch}%,email.ilike.%${clientSearch}%`)
          .limit(8);

        const results: ClientInfo[] = (records || []).map((r: Record<string, unknown>) => ({
          id: r.id as string,
          name: (r.title as string) || 'Unknown',
          email: (r.email as string) || '',
          phone: (r.phone as string) || undefined,
          company: ((r.data as Record<string, unknown>)?.company as string) || undefined,
        }));

        setClientResults(results);
      } catch {
        // Silently handle search errors
      } finally {
        setSearchingClients(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [clientSearch, supabase]);

  // ========================================================================
  // Save & Send
  // ========================================================================

  async function handleSave(sendAfterSave = false) {
    if (!client) {
      toast.error('Please select a client');
      return;
    }
    if (lineItems.every((i) => !i.description && i.rate === 0)) {
      toast.error('Please add at least one line item');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        invoice_number: invoiceNumber,
        client_id: client.id,
        client_name: client.name,
        client_email: client.email,
        issue_date: issueDate,
        due_date: dueDate,
        payment_terms: paymentTerms,
        currency,
        line_items: lineItems.filter((i) => i.description || i.rate > 0),
        subtotal: calculations.subtotal,
        tax_total: calculations.taxTotal,
        discount_type: discountType,
        discount_value: discountValue,
        discount_amount: calculations.discountAmount,
        total: calculations.total,
        notes,
        terms,
        status: sendAfterSave ? 'sent' : 'draft',
      };

      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save invoice');
      }

      toast.success(sendAfterSave ? 'Invoice sent successfully' : 'Invoice saved as draft');
      router.push('/crm/invoices');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save invoice');
    } finally {
      setSaving(false);
    }
  }

  // ========================================================================
  // Render
  // ========================================================================

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/crm/invoices">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">New Invoice</h1>
            <p className="text-slate-500 dark:text-slate-400">
              Create a professional invoice for your client
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
            {showPreview ? 'Edit' : 'Preview'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleSave(false)} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            Save Draft
          </Button>
          <Button
            size="sm"
            className="bg-teal-600 hover:bg-teal-700 text-white"
            onClick={() => handleSave(true)}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Send Invoice
          </Button>
        </div>
      </div>

      {showPreview ? (
        /* ================================================================ */
        /* Preview Mode */
        /* ================================================================ */
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-8 bg-white dark:bg-slate-900">
          {/* Preview Header */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-1">INVOICE</h2>
              <p className="text-slate-500 dark:text-slate-400 font-mono">{invoiceNumber}</p>
            </div>
            <Badge className="bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400">
              Draft
            </Badge>
          </div>

          {/* Preview Details */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Bill To</p>
              {client ? (
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{client.name}</p>
                  {client.company && <p className="text-sm text-slate-600 dark:text-slate-400">{client.company}</p>}
                  <p className="text-sm text-slate-600 dark:text-slate-400">{client.email}</p>
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic">No client selected</p>
              )}
            </div>
            <div className="text-right">
              <div className="space-y-1 text-sm">
                <p><span className="text-slate-500">Issue Date:</span> <span className="font-medium text-slate-900 dark:text-white">{issueDate}</span></p>
                <p><span className="text-slate-500">Due Date:</span> <span className="font-medium text-slate-900 dark:text-white">{dueDate}</span></p>
                <p><span className="text-slate-500">Terms:</span> <span className="font-medium text-slate-900 dark:text-white">{PAYMENT_TERMS_LABELS[paymentTerms]}</span></p>
              </div>
            </div>
          </div>

          {/* Preview Line Items */}
          <table className="w-full mb-8">
            <thead>
              <tr className="border-b-2 border-slate-200 dark:border-slate-700">
                <th className="text-left py-2 text-xs text-slate-500 uppercase">Description</th>
                <th className="text-right py-2 text-xs text-slate-500 uppercase">Qty</th>
                <th className="text-right py-2 text-xs text-slate-500 uppercase">Rate</th>
                <th className="text-right py-2 text-xs text-slate-500 uppercase">Tax</th>
                <th className="text-right py-2 text-xs text-slate-500 uppercase">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lineItems
                .filter((i) => i.description || i.rate > 0)
                .map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-3 text-sm text-slate-900 dark:text-white">{item.description || '—'}</td>
                    <td className="py-3 text-sm text-right text-slate-600 dark:text-slate-400">{item.quantity}</td>
                    <td className="py-3 text-sm text-right text-slate-600 dark:text-slate-400">{formatCurrency(item.rate)}</td>
                    <td className="py-3 text-sm text-right text-slate-600 dark:text-slate-400">{item.taxRate}%</td>
                    <td className="py-3 text-sm text-right font-medium text-slate-900 dark:text-white">{formatCurrency(item.quantity * item.rate)}</td>
                  </tr>
                ))}
            </tbody>
          </table>

          {/* Preview Totals */}
          <div className="flex justify-end mb-8">
            <div className="w-72 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="text-slate-900 dark:text-white">{formatCurrency(calculations.subtotal)}</span>
              </div>
              {calculations.taxTotal > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Tax</span>
                  <span className="text-slate-900 dark:text-white">{formatCurrency(calculations.taxTotal)}</span>
                </div>
              )}
              {calculations.discountAmount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount</span>
                  <span>-{formatCurrency(calculations.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold border-t-2 border-slate-200 dark:border-slate-700 pt-2">
                <span className="text-slate-900 dark:text-white">Total</span>
                <span className="text-teal-600 dark:text-teal-400">{formatCurrency(calculations.total)}</span>
              </div>
            </div>
          </div>

          {/* Preview Notes */}
          {notes && (
            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Notes</p>
              <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{notes}</p>
            </div>
          )}
          {terms && (
            <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Terms & Conditions</p>
              <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{terms}</p>
            </div>
          )}
        </div>
      ) : (
        /* ================================================================ */
        /* Edit Mode */
        /* ================================================================ */
        <>
          {/* Invoice Details & Client */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Invoice Details */}
            <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6 space-y-4">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-500" />
                Invoice Details
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Invoice Number
                  </label>
                  <Input
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Issue Date
                  </label>
                  <Input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Payment Terms
                  </label>
                  <Select
                    value={paymentTerms}
                    onValueChange={(v) => setPaymentTerms(v as PaymentTerms)}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PAYMENT_TERMS_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Due Date
                  </label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => {
                      setDueDate(e.target.value);
                      setPaymentTerms('custom');
                    }}
                    className="text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Client Selection */}
            <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6 space-y-4">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-teal-500" />
                Bill To
              </h2>

              {client ? (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{client.name}</p>
                      {client.company && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3" /> {client.company}
                        </p>
                      )}
                      <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3" /> {client.email}
                      </p>
                      {client.phone && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3" /> {client.phone}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setClient(null);
                        setShowClientSearch(true);
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      value={clientSearch}
                      onChange={(e) => {
                        setClientSearch(e.target.value);
                        setShowClientSearch(true);
                      }}
                      onFocus={() => setShowClientSearch(true)}
                      placeholder="Search contacts by name or email..."
                      className="pl-9 text-sm"
                    />
                    {searchingClients && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
                    )}
                  </div>

                  {showClientSearch && clientResults.length > 0 && (
                    <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {clientResults.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => {
                            setClient(r);
                            setClientSearch('');
                            setShowClientSearch(false);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-3"
                        >
                          <div className="w-8 h-8 bg-teal-100 dark:bg-teal-500/20 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900 dark:text-white">{r.name}</p>
                            <p className="text-xs text-slate-500">{r.email}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {showClientSearch && clientSearch.length >= 2 && clientResults.length === 0 && !searchingClients && (
                    <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-4 text-center">
                      <p className="text-sm text-slate-500">No contacts found</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Line Items */}
          <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-teal-500" />
                Line Items
              </h2>
              <Button variant="outline" size="sm" onClick={handleAddLineItem}>
                <Plus className="w-4 h-4 mr-1" />
                Add Item
              </Button>
            </div>

            {/* Column Headers */}
            <div className="grid grid-cols-12 gap-3 mb-2">
              <div className="col-span-1 text-xs text-slate-500 text-center">#</div>
              <div className="col-span-4 text-xs text-slate-500">Description</div>
              <div className="col-span-1 text-xs text-slate-500 text-right">Qty</div>
              <div className="col-span-2 text-xs text-slate-500 text-right">Rate</div>
              <div className="col-span-1 text-xs text-slate-500 text-right">Tax %</div>
              <div className="col-span-2 text-xs text-slate-500 text-right">Amount</div>
            </div>

            <div className="divide-y-0">
              {lineItems.map((item, idx) => (
                <LineItemRow
                  key={item.id}
                  item={item}
                  index={idx}
                  onUpdate={handleUpdateLineItem}
                  onRemove={handleRemoveLineItem}
                  onDuplicate={handleDuplicateLineItem}
                  canRemove={lineItems.length > 1}
                />
              ))}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleAddLineItem}
              className="mt-3 text-teal-600 dark:text-teal-400 hover:text-teal-700"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Line Item
            </Button>
          </div>

          {/* Totals & Discount */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Notes & Terms */}
            <div className="space-y-4">
              <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                  Notes (visible to client)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Thank you for your business..."
                  rows={3}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 resize-none"
                />
              </div>
              <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                  Terms & Conditions
                </label>
                <textarea
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 resize-none"
                />
              </div>
            </div>

            {/* Summary */}
            <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Summary</h2>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {formatCurrency(calculations.subtotal)}
                  </span>
                </div>

                {calculations.taxTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Tax</span>
                    <span className="text-slate-900 dark:text-white">
                      {formatCurrency(calculations.taxTotal)}
                    </span>
                  </div>
                )}

                {/* Discount row */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Discount</span>
                  <div className="flex items-center gap-2">
                    <Select
                      value={discountType}
                      onValueChange={(v) => setDiscountType(v as 'percent' | 'fixed')}
                    >
                      <SelectTrigger className="h-8 w-20 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">%</SelectItem>
                        <SelectItem value="fixed">$</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={0}
                      value={discountValue || ''}
                      onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                      className="h-8 w-20 text-sm text-right"
                    />
                  </div>
                </div>

                {calculations.discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount Applied</span>
                    <span>-{formatCurrency(calculations.discountAmount)}</span>
                  </div>
                )}

                <div className="border-t-2 border-slate-200 dark:border-slate-700 pt-3 flex justify-between">
                  <span className="text-lg font-bold text-slate-900 dark:text-white">Total</span>
                  <span className="text-lg font-bold text-teal-600 dark:text-teal-400">
                    {formatCurrency(calculations.total)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
