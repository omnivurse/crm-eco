'use client';

/**
 * Invoice Edit Page
 *
 * Loads an existing invoice (org-scoped) and lets the user update it.
 * Mirrors the visual structure of the New Invoice builder
 * (crm/invoices/new/page.tsx) but persists via direct Supabase update against
 * the real `invoices` table — the same data layer used by crm/invoices/page.tsx.
 *
 * Note: the `invoices` table does not have a `line_items` column, so the line
 * editor here is an in-memory helper that feeds the persisted totals
 * (subtotal, tax_amount, total). Persisted fields match database.ts exactly.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Receipt,
  Send,
  Save,
  DollarSign,
  Percent,
  Copy,
  FileText,
  Building2,
  User,
  Mail,
  Phone,
  Search,
  Loader2,
  X,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase-client';
import { useClientAuth } from '@/hooks/useClientAuth';

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
}

// ============================================================================
// Helpers
// ============================================================================

function generateId(): string {
  return `item_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
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
      <div className="col-span-1 flex items-center justify-center pt-2">
        <span className="text-xs text-slate-400 font-medium w-6 text-center">{index + 1}</span>
      </div>

      <div className="col-span-4">
        <Input
          value={item.description}
          onChange={(e) => onUpdate(item.id, 'description', e.target.value)}
          placeholder="Item description"
          className="text-sm"
        />
      </div>

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
// Main Edit Page
// ============================================================================

export default function EditInvoicePage() {
  const router = useRouter();
  const params = useParams();
  const invoiceId = (params?.id as string) || '';
  const { profile: authProfile, loading: authLoading } = useClientAuth();

  // Load state
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Invoice metadata
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceStatus, setInvoiceStatus] = useState<string>('draft');
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [currency, setCurrency] = useState('USD');

  // Client
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<ClientInfo[]>([]);
  const [searchingClients, setSearchingClients] = useState(false);
  const [showClientSearch, setShowClientSearch] = useState(false);

  // Line items (in-memory editor — feeds persisted totals)
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: generateId(), description: '', quantity: 1, rate: 0, taxRate: 0, amount: 0 },
  ]);

  // Discount
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState(0);

  // Notes
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');

  // UI state
  const [saving, setSaving] = useState(false);

  // ========================================================================
  // Load invoice (org-scoped)
  // ========================================================================

  useEffect(() => {
    if (authLoading) return;
    if (!authProfile) {
      setLoading(false);
      return;
    }
    if (!invoiceId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadInvoice() {
      try {
        const { data, error } = await supabase
          .from('invoices')
          .select(`
            id,
            invoice_number,
            title,
            status,
            subtotal,
            discount_type,
            discount_value,
            tax_rate,
            tax_amount,
            total,
            due_date,
            currency,
            notes,
            terms,
            contact_id,
            contact:crm_records!invoices_contact_id_fkey(id, title, email, phone, data)
          `)
          .eq('id', invoiceId)
          .eq('organization_id', authProfile!.organization_id)
          .maybeSingle();

        if (cancelled) return;

        if (error) throw error;
        if (!data) {
          setNotFound(true);
          return;
        }

        const inv = data as unknown as {
          invoice_number: string;
          title: string | null;
          status: string | null;
          subtotal: number | null;
          discount_type: string | null;
          discount_value: number | null;
          tax_rate: number | null;
          tax_amount: number | null;
          total: number | null;
          due_date: string | null;
          currency: string | null;
          notes: string | null;
          terms: string | null;
          contact:
            | { id: string; title: string | null; email: string | null; phone: string | null; data: Record<string, unknown> | null }
            | { id: string; title: string | null; email: string | null; phone: string | null; data: Record<string, unknown> | null }[]
            | null;
        };

        setInvoiceNumber(inv.invoice_number || '');
        setInvoiceStatus(inv.status || 'draft');
        setTitle(inv.title || '');
        setDueDate(inv.due_date ? inv.due_date.split('T')[0] : '');
        setCurrency(inv.currency || 'USD');
        setDiscountType((inv.discount_type as 'percent' | 'fixed') || 'percent');
        setDiscountValue(inv.discount_value || 0);
        setNotes(inv.notes || '');
        setTerms(inv.terms || '');

        // Resolve linked contact (PostgREST embed may be object or array)
        const contactRow = Array.isArray(inv.contact) ? inv.contact[0] : inv.contact;
        if (contactRow) {
          setClient({
            id: contactRow.id,
            name: contactRow.title || 'Unknown',
            email: contactRow.email || '',
            phone: contactRow.phone || undefined,
            company: (contactRow.data?.company as string) || undefined,
          });
        }

        // Rehydrate a single line item from the persisted totals so the editor
        // has a sensible starting point (the table stores aggregates, not lines).
        const subtotal = inv.subtotal || 0;
        const taxAmount = inv.tax_amount || 0;
        const taxRate =
          inv.tax_rate != null
            ? inv.tax_rate
            : subtotal > 0
              ? Math.round((taxAmount / subtotal) * 1000) / 10
              : 0;
        setLineItems([
          {
            id: generateId(),
            description: inv.title || 'Invoice total',
            quantity: 1,
            rate: subtotal,
            taxRate,
            amount: subtotal,
          },
        ]);
      } catch (err) {
        if (!cancelled) {
          console.error('Error loading invoice:', err);
          toast.error('Failed to load invoice');
          setNotFound(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadInvoice();

    return () => {
      cancelled = true;
    };
  }, [authLoading, authProfile, invoiceId]);

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
    const effectiveTaxRate = subtotal > 0 ? (taxTotal / subtotal) * 100 : 0;

    return { subtotal, taxTotal, discountAmount, total, effectiveTaxRate };
  }, [lineItems, discountType, discountValue]);

  // ========================================================================
  // Line item actions
  // ========================================================================

  const updateLineItemAmount = useCallback((items: LineItem[]): LineItem[] => {
    return items.map((item) => ({ ...item, amount: item.quantity * item.rate }));
  }, []);

  function handleUpdateLineItem(id: string, field: keyof LineItem, value: string | number) {
    setLineItems((prev) => {
      const updated = prev.map((item) => (item.id === id ? { ...item, [field]: value } : item));
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
        let query = supabase
          .from('crm_records')
          .select('id, title, email, phone, data')
          .or(`title.ilike.%${clientSearch}%,email.ilike.%${clientSearch}%`)
          .limit(8);

        if (authProfile?.organization_id) {
          query = query.eq('organization_id', authProfile.organization_id);
        }

        const { data: records } = await query;

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
  }, [clientSearch, authProfile]);

  // ========================================================================
  // Save / Update
  // ========================================================================

  async function handleSave(sendAfterSave = false) {
    if (!authProfile) {
      toast.error('You must be signed in to edit invoices');
      return;
    }
    if (lineItems.every((i) => !i.description && i.rate === 0)) {
      toast.error('Please add at least one line item');
      return;
    }

    setSaving(true);
    try {
      const nextStatus = sendAfterSave ? 'sent' : invoiceStatus || 'draft';

      const payload: Record<string, unknown> = {
        invoice_number: invoiceNumber,
        title: title || client?.name || null,
        contact_id: client?.id ?? null,
        status: nextStatus,
        subtotal: calculations.subtotal,
        // DB CHECK allows only 'fixed' | 'percentage' (never 'percent').
        discount_type: discountType === 'fixed' ? 'fixed' : 'percentage',
        discount_value: discountValue,
        tax_rate: Math.round(calculations.effectiveTaxRate * 100) / 100,
        tax_amount: calculations.taxTotal,
        total: calculations.total,
        balance_due: calculations.total,
        due_date: dueDate || null,
        currency,
        notes: notes || null,
        terms: terms || null,
        updated_at: new Date().toISOString(),
      };

      if (sendAfterSave) {
        payload.sent_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('invoices')
        .update(payload)
        .eq('id', invoiceId)
        .eq('organization_id', authProfile.organization_id);

      if (error) throw error;

      toast.success(sendAfterSave ? 'Invoice sent successfully' : 'Invoice updated');
      router.push('/crm/invoices');
    } catch (error) {
      console.error('Error updating invoice:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update invoice');
    } finally {
      setSaving(false);
    }
  }

  // ========================================================================
  // Loading / guard states
  // ========================================================================

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  if (!authProfile) {
    return (
      <div className="max-w-5xl mx-auto py-16 text-center">
        <p className="text-slate-900 dark:text-white font-medium mb-2">Sign in required</p>
        <p className="text-slate-500 text-sm">You must be signed in to edit invoices.</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-5xl mx-auto py-16 text-center">
        <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 w-fit mx-auto mb-4">
          <Receipt className="w-8 h-8 text-slate-400" />
        </div>
        <p className="text-slate-900 dark:text-white font-medium mb-1">Invoice not found</p>
        <p className="text-slate-500 text-sm mb-4">
          This invoice does not exist or you do not have access to it.
        </p>
        <Button asChild variant="outline">
          <Link href="/crm/invoices">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Invoices
          </Link>
        </Button>
      </div>
    );
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
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Edit Invoice</h1>
            <p className="text-slate-500 dark:text-slate-400 font-mono text-sm">
              {invoiceNumber}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleSave(false)} disabled={saving}>
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Changes
          </Button>
          <Button
            size="sm"
            className="bg-teal-600 hover:bg-teal-700 text-white"
            onClick={() => handleSave(true)}
            disabled={saving}
          >
            <Send className="w-4 h-4 mr-2" />
            Save &amp; Send
          </Button>
        </div>
      </div>

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
                Due Date
              </label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Title
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Invoice title / description"
                className="text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Status
              </label>
              <Select value={invoiceStatus} onValueChange={(v) => setInvoiceStatus(v)}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="viewed">Viewed</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Currency
              </label>
              <Input
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                maxLength={3}
                className="text-sm uppercase"
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
                  {client.email && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                      <Mail className="w-3 h-3" /> {client.email}
                    </p>
                  )}
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

              {showClientSearch &&
                clientSearch.length >= 2 &&
                clientResults.length === 0 &&
                !searchingClients && (
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

      {/* Totals & Notes */}
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
              Terms &amp; Conditions
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
    </div>
  );
}
