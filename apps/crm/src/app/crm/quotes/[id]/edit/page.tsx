'use client';

/**
 * Quote Edit Page
 *
 * Loads an existing quote (org-scoped) by id and lets the user update it.
 * Mirrors the layout/UX of crm/quotes/new/page.tsx (the create form):
 * - Prospect/contact lookup
 * - Products & services line items with per-item discount
 * - Validity period / expiry
 * - Notes + terms
 * - Preview toggle
 *
 * Persistence note: unlike new/page.tsx (which POSTs to a not-yet-built
 * /api/quotes route), this page reads and writes directly against the live
 * `quotes` + `quote_line_items` schema via the singleton Supabase browser
 * client — the same working pattern used by crm/quotes/page.tsx. This keeps
 * the edit flow round-tripping correctly with the quotes list.
 */

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Trash2,
  FileCheck,
  Send,
  Save,
  Eye,
  EyeOff,
  DollarSign,
  Copy,
  Building2,
  User,
  Mail,
  Search,
  Loader2,
  X,
  ShieldCheck,
  Clock,
  Tag,
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
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase-client';
import { useClientAuth } from '@/hooks/useClientAuth';

// ============================================================================
// Types
// ============================================================================

interface QuoteLineItem {
  id: string;
  productName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  discountType: 'percent' | 'fixed';
  amount: number;
}

interface ProspectInfo {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
}

type ValidityPeriod = '7' | '14' | '30' | '60' | '90' | 'custom';

const VALIDITY_LABELS: Record<ValidityPeriod, string> = {
  '7': '7 Days',
  '14': '14 Days',
  '30': '30 Days',
  '60': '60 Days',
  '90': '90 Days',
  custom: 'Custom Date',
};

// ============================================================================
// Helpers
// ============================================================================

function generateId(): string {
  return `qi_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function toDateInput(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toISOString().split('T')[0];
}

function calcItemAmount(item: QuoteLineItem): number {
  const gross = item.quantity * item.unitPrice;
  if (item.discountType === 'percent') {
    return gross - gross * (item.discount / 100);
  }
  return gross - item.discount;
}

// ============================================================================
// Line Item Row
// ============================================================================

function QuoteItemRow({
  item,
  index,
  onUpdate,
  onRemove,
  onDuplicate,
  canRemove,
}: {
  item: QuoteLineItem;
  index: number;
  onUpdate: (id: string, updates: Partial<QuoteLineItem>) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  canRemove: boolean;
}) {
  return (
    <div className="group border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:border-teal-500/30 transition-colors">
      <div className="flex items-start gap-4">
        <span className="text-xs font-bold text-slate-400 mt-2 w-5 text-center">{index + 1}</span>

        <div className="flex-1 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Product / Service</label>
              <Input
                value={item.productName}
                onChange={(e) => onUpdate(item.id, { productName: e.target.value })}
                placeholder="e.g. Website Redesign"
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Description</label>
              <Input
                value={item.description}
                onChange={(e) => onUpdate(item.id, { description: e.target.value })}
                placeholder="Brief description"
                className="text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Quantity</label>
              <Input
                type="number"
                min={0}
                step={1}
                value={item.quantity || ''}
                onChange={(e) => onUpdate(item.id, { quantity: parseFloat(e.target.value) || 0 })}
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Unit Price</label>
              <div className="relative">
                <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={item.unitPrice || ''}
                  onChange={(e) => onUpdate(item.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                  className="text-sm pl-7"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Discount</label>
              <div className="flex gap-1">
                <Input
                  type="number"
                  min={0}
                  value={item.discount || ''}
                  onChange={(e) => onUpdate(item.id, { discount: parseFloat(e.target.value) || 0 })}
                  className="text-sm flex-1"
                />
                <Select
                  value={item.discountType}
                  onValueChange={(v) => onUpdate(item.id, { discountType: v as 'percent' | 'fixed' })}
                >
                  <SelectTrigger className="w-14 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">%</SelectItem>
                    <SelectItem value="fixed">$</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Line Total</label>
              <div className="h-9 flex items-center justify-end px-3 bg-slate-50 dark:bg-slate-800/50 rounded-md text-sm font-semibold text-slate-900 dark:text-white">
                {formatCurrency(calcItemAmount(item))}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1 pt-6 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onDuplicate(item.id)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded" title="Duplicate">
            <Copy className="w-3.5 h-3.5 text-slate-400" />
          </button>
          {canRemove && (
            <button onClick={() => onRemove(item.id)} className="p-1 hover:bg-red-50 dark:hover:bg-red-500/10 rounded" title="Remove">
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Quote Editor
// ============================================================================

export default function EditQuotePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const quoteId = params?.id as string;
  const { profile: authProfile, loading: authLoading } = useClientAuth();

  // Load state
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Metadata
  const [quoteNumber, setQuoteNumber] = useState('');
  const [quoteDate, setQuoteDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [validityPeriod, setValidityPeriod] = useState<ValidityPeriod>('custom');
  const [expiryDate, setExpiryDate] = useState(() => addDays(new Date().toISOString().split('T')[0], 30));
  const [quoteTitle, setQuoteTitle] = useState('');
  const [status, setStatus] = useState<string>('draft');

  // Prospect
  const [prospect, setProspect] = useState<ProspectInfo | null>(null);
  const [prospectSearch, setProspectSearch] = useState('');
  const [prospectResults, setProspectResults] = useState<ProspectInfo[]>([]);
  const [searchingProspects, setSearchingProspects] = useState(false);
  const [showProspectSearch, setShowProspectSearch] = useState(false);

  // Line items
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([]);

  // Notes
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');

  // UI
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // ========================================================================
  // Load existing quote (org-scoped)
  // ========================================================================

  useEffect(() => {
    if (authLoading) return;
    if (!authProfile?.organization_id) {
      setLoadError('You must be signed in to edit a quote.');
      setLoading(false);
      return;
    }
    if (!quoteId) {
      setLoadError('Missing quote id.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const { data, error } = await supabase
          .from('quotes')
          .select(`
            id,
            quote_number,
            title,
            status,
            subtotal,
            discount_type,
            discount_value,
            tax_amount,
            total,
            valid_until,
            notes,
            terms,
            created_at,
            contact_id,
            contact:crm_records!quotes_contact_id_fkey(id, title, email, phone, data),
            quote_line_items(
              id,
              name,
              description,
              quantity,
              unit_price,
              discount_type,
              discount_value,
              total,
              sort_order
            )
          `)
          .eq('id', quoteId)
          .eq('organization_id', authProfile!.organization_id)
          .single();

        if (error) throw error;
        if (!data) throw new Error('Quote not found');
        if (cancelled) return;

        const row = data as unknown as {
          quote_number: string | null;
          title: string | null;
          status: string | null;
          discount_type: string | null;
          valid_until: string | null;
          notes: string | null;
          terms: string | null;
          created_at: string | null;
          contact_id: string | null;
          contact?: { id: string; title: string | null; email: string | null; phone: string | null; data: Record<string, unknown> | null }[] | null;
          quote_line_items?: {
            id: string;
            name: string;
            description: string | null;
            quantity: number | null;
            unit_price: number;
            discount_type: string | null;
            discount_value: number | null;
            total: number;
            sort_order: number | null;
          }[] | null;
        };

        const fallbackDate = new Date().toISOString().split('T')[0];
        const createdDate = toDateInput(row.created_at, fallbackDate);

        setQuoteNumber(row.quote_number || '');
        setQuoteTitle(row.title || '');
        setStatus(row.status || 'draft');
        setQuoteDate(createdDate);
        setExpiryDate(toDateInput(row.valid_until, addDays(createdDate, 30)));
        setValidityPeriod('custom');
        setNotes(row.notes || '');
        setTerms(row.terms || '');

        const contact = row.contact?.[0];
        if (contact) {
          setProspect({
            id: contact.id,
            name: contact.title || 'Unknown',
            email: contact.email || '',
            phone: contact.phone || undefined,
            company: (contact.data?.company as string) || undefined,
          });
        } else {
          setProspect(null);
        }

        const items = (row.quote_line_items || [])
          .slice()
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map<QuoteLineItem>((li) => {
            const mapped: QuoteLineItem = {
              id: li.id || generateId(),
              productName: li.name || '',
              description: li.description || '',
              quantity: li.quantity ?? 1,
              unitPrice: li.unit_price ?? 0,
              discount: li.discount_value ?? 0,
              discountType: li.discount_type === 'fixed' ? 'fixed' : 'percent',
              amount: 0,
            };
            mapped.amount = calcItemAmount(mapped);
            return mapped;
          });

        setLineItems(
          items.length > 0
            ? items
            : [{ id: generateId(), productName: '', description: '', quantity: 1, unitPrice: 0, discount: 0, discountType: 'percent', amount: 0 }]
        );
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Failed to load quote');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [authLoading, authProfile, quoteId]);

  // ========================================================================
  // Auto-calculate expiry when a fixed validity period is chosen
  // ========================================================================

  useEffect(() => {
    if (validityPeriod !== 'custom') {
      setExpiryDate(addDays(quoteDate, parseInt(validityPeriod)));
    }
  }, [validityPeriod, quoteDate]);

  // ========================================================================
  // Calculations
  // ========================================================================

  const calculations = useMemo(() => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const totalDiscount = lineItems.reduce((sum, item) => {
      const gross = item.quantity * item.unitPrice;
      const net = calcItemAmount(item);
      return sum + (gross - net);
    }, 0);
    const total = subtotal - totalDiscount;
    return { subtotal, totalDiscount, total };
  }, [lineItems]);

  // ========================================================================
  // Line item actions
  // ========================================================================

  function handleUpdateLineItem(id: string, updates: Partial<QuoteLineItem>) {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, ...updates };
        updated.amount = calcItemAmount(updated);
        return updated;
      })
    );
  }

  function handleAddLineItem() {
    setLineItems((prev) => [
      ...prev,
      { id: generateId(), productName: '', description: '', quantity: 1, unitPrice: 0, discount: 0, discountType: 'percent', amount: 0 },
    ]);
  }

  function handleRemoveLineItem(id: string) {
    setLineItems((prev) => prev.filter((i) => i.id !== id));
  }

  function handleDuplicateLineItem(id: string) {
    setLineItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (!item) return prev;
      const idx = prev.indexOf(item);
      const dup = { ...item, id: generateId() };
      const next = [...prev];
      next.splice(idx + 1, 0, dup);
      return next;
    });
  }

  // ========================================================================
  // Prospect search
  // ========================================================================

  useEffect(() => {
    if (!prospectSearch || prospectSearch.length < 2) {
      setProspectResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingProspects(true);
      try {
        let query = supabase
          .from('crm_records')
          .select('id, title, email, phone, data')
          .or(`title.ilike.%${prospectSearch}%,email.ilike.%${prospectSearch}%`)
          .limit(8);

        if (authProfile?.organization_id) {
          query = query.eq('organization_id', authProfile.organization_id);
        }

        const { data: records } = await query;

        const results: ProspectInfo[] = (records || []).map((r: Record<string, unknown>) => ({
          id: r.id as string,
          name: (r.title as string) || 'Unknown',
          email: (r.email as string) || '',
          phone: (r.phone as string) || undefined,
          company: ((r.data as Record<string, unknown>)?.company as string) || undefined,
        }));

        setProspectResults(results);
      } catch {
        // Silently handle search errors
      } finally {
        setSearchingProspects(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [prospectSearch, authProfile]);

  // ========================================================================
  // Save (update)
  // ========================================================================

  async function handleSave(sendAfterSave = false) {
    if (!authProfile?.organization_id) {
      toast.error('You must be signed in to save a quote');
      return;
    }
    if (!prospect) {
      toast.error('Please select a prospect');
      return;
    }
    if (lineItems.every((i) => !i.productName && i.unitPrice === 0)) {
      toast.error('Please add at least one line item');
      return;
    }

    setSaving(true);
    try {
      const persistedItems = lineItems.filter((i) => i.productName || i.unitPrice > 0);
      const nextStatus = sendAfterSave ? 'sent' : status === 'draft' ? 'draft' : status;

      // Update the quote (org-scoped)
      const { error: quoteError } = await supabase
        .from('quotes')
        .update({
          title: quoteTitle || `Quote for ${prospect.name}`,
          contact_id: prospect.id,
          valid_until: expiryDate || null,
          subtotal: calculations.subtotal,
          discount_value: calculations.totalDiscount,
          discount_type: 'fixed',
          total: calculations.total,
          notes: notes || null,
          terms: terms || null,
          status: nextStatus,
          ...(sendAfterSave ? { sent_at: new Date().toISOString() } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', quoteId)
        .eq('organization_id', authProfile.organization_id);

      if (quoteError) throw quoteError;

      // Replace line items SAFELY. The Supabase JS client cannot run a
      // multi-statement transaction, so we capture the existing rows, INSERT
      // the new set FIRST, and only delete the previously-stored rows once the
      // insert succeeds. A failed insert (e.g. a constraint violation) can
      // therefore never leave the quote with its line items wiped. There is no
      // unique constraint on quote_line_items, so the old and new rows can
      // briefly coexist without collision.
      const { data: existingLineItems, error: existingError } = await supabase
        .from('quote_line_items')
        .select('id')
        .eq('quote_id', quoteId);

      if (existingError) throw existingError;

      if (persistedItems.length > 0) {
        const { error: insertError } = await supabase.from('quote_line_items').insert(
          persistedItems.map((item, index) => ({
            quote_id: quoteId,
            name: item.productName || 'Item',
            description: item.description || null,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            // DB CHECK allows only 'fixed' | 'percentage' (never 'percent').
            discount_type: item.discountType === 'fixed' ? 'fixed' : 'percentage',
            discount_value: item.discount,
            total: calcItemAmount(item),
            sort_order: index,
          }))
        );

        if (insertError) throw insertError;
      }

      const previousLineItemIds = ((existingLineItems ?? []) as { id: string }[]).map(
        (r) => r.id,
      );
      if (previousLineItemIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('quote_line_items')
          .delete()
          .in('id', previousLineItemIds);

        if (deleteError) throw deleteError;
      }

      toast.success(sendAfterSave ? 'Quote sent successfully' : 'Quote updated');
      router.push('/crm/quotes');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save quote');
    } finally {
      setSaving(false);
    }
  }

  // ========================================================================
  // Render: loading / error states
  // ========================================================================

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-12 text-center">
          <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 w-fit mx-auto mb-4">
            <FileCheck className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-slate-900 dark:text-white font-medium mb-1">Unable to load quote</p>
          <p className="text-slate-500 text-sm mb-4">{loadError}</p>
          <Button variant="outline" asChild>
            <Link href="/crm/quotes">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Quotes
            </Link>
          </Button>
        </div>
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
            <Link href="/crm/quotes">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Edit Quote</h1>
            <p className="text-slate-500 dark:text-slate-400">
              Update the details of this quote
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)}>
            {showPreview ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
            {showPreview ? 'Edit' : 'Preview'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleSave(false)} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Changes
          </Button>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => handleSave(true)} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Send Quote
          </Button>
        </div>
      </div>

      {showPreview ? (
        /* ================================================================ */
        /* Preview */
        /* ================================================================ */
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-8 bg-white dark:bg-slate-900">
          <div className="flex items-start justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-1">QUOTE</h2>
              <p className="text-slate-500 dark:text-slate-400 font-mono">{quoteNumber}</p>
              {quoteTitle && <p className="text-lg text-slate-700 dark:text-slate-300 mt-2">{quoteTitle}</p>}
            </div>
            <Badge className="bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 capitalize">{status}</Badge>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Prepared For</p>
              {prospect ? (
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{prospect.name}</p>
                  {prospect.company && <p className="text-sm text-slate-600 dark:text-slate-400">{prospect.company}</p>}
                  <p className="text-sm text-slate-600 dark:text-slate-400">{prospect.email}</p>
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic">No prospect selected</p>
              )}
            </div>
            <div className="text-right space-y-1 text-sm">
              <p><span className="text-slate-500">Quote Date:</span> <span className="font-medium text-slate-900 dark:text-white">{quoteDate}</span></p>
              <p><span className="text-slate-500">Valid Until:</span> <span className="font-medium text-slate-900 dark:text-white">{expiryDate}</span></p>
            </div>
          </div>

          <table className="w-full mb-8">
            <thead>
              <tr className="border-b-2 border-slate-200 dark:border-slate-700">
                <th className="text-left py-2 text-xs text-slate-500 uppercase">Product / Service</th>
                <th className="text-left py-2 text-xs text-slate-500 uppercase">Description</th>
                <th className="text-right py-2 text-xs text-slate-500 uppercase">Qty</th>
                <th className="text-right py-2 text-xs text-slate-500 uppercase">Price</th>
                <th className="text-right py-2 text-xs text-slate-500 uppercase">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.filter((i) => i.productName || i.unitPrice > 0).map((item) => (
                <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-3 text-sm font-medium text-slate-900 dark:text-white">{item.productName || '—'}</td>
                  <td className="py-3 text-sm text-slate-600 dark:text-slate-400">{item.description || '—'}</td>
                  <td className="py-3 text-sm text-right text-slate-600 dark:text-slate-400">{item.quantity}</td>
                  <td className="py-3 text-sm text-right text-slate-600 dark:text-slate-400">{formatCurrency(item.unitPrice)}</td>
                  <td className="py-3 text-sm text-right font-medium text-slate-900 dark:text-white">{formatCurrency(calcItemAmount(item))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end mb-8">
            <div className="w-72 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="text-slate-900 dark:text-white">{formatCurrency(calculations.subtotal)}</span>
              </div>
              {calculations.totalDiscount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount</span>
                  <span>-{formatCurrency(calculations.totalDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold border-t-2 border-slate-200 dark:border-slate-700 pt-2">
                <span className="text-slate-900 dark:text-white">Total</span>
                <span className="text-blue-600 dark:text-blue-400">{formatCurrency(calculations.total)}</span>
              </div>
            </div>
          </div>

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
          {/* Quote Details & Prospect */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quote Details */}
            <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6 space-y-4">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-blue-500" />
                Quote Details
              </h2>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Quote Title</label>
                <Input
                  value={quoteTitle}
                  onChange={(e) => setQuoteTitle(e.target.value)}
                  placeholder="e.g. Website Redesign Proposal"
                  className="text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Quote Number</label>
                  <Input value={quoteNumber} readOnly disabled className="font-mono text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Quote Date</label>
                  <Input type="date" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} className="text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Valid For</label>
                  <Select value={validityPeriod} onValueChange={(v) => setValidityPeriod(v as ValidityPeriod)}>
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(VALIDITY_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Expiry Date</label>
                  <Input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => { setExpiryDate(e.target.value); setValidityPeriod('custom'); }}
                    className="text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Prospect Selection */}
            <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6 space-y-4">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-500" />
                Prepared For
              </h2>

              {prospect ? (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{prospect.name}</p>
                      {prospect.company && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3" /> {prospect.company}
                        </p>
                      )}
                      <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3" /> {prospect.email}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { setProspect(null); setShowProspectSearch(true); }}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      value={prospectSearch}
                      onChange={(e) => { setProspectSearch(e.target.value); setShowProspectSearch(true); }}
                      onFocus={() => setShowProspectSearch(true)}
                      placeholder="Search contacts by name or email..."
                      className="pl-9 text-sm"
                    />
                    {searchingProspects && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />}
                  </div>

                  {showProspectSearch && prospectResults.length > 0 && (
                    <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {prospectResults.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => { setProspect(r); setProspectSearch(''); setShowProspectSearch(false); }}
                          className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-3"
                        >
                          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-500/20 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900 dark:text-white">{r.name}</p>
                            <p className="text-xs text-slate-500">{r.email}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {showProspectSearch && prospectSearch.length >= 2 && prospectResults.length === 0 && !searchingProspects && (
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
                <Tag className="w-4 h-4 text-blue-500" />
                Products & Services
              </h2>
              <Button variant="outline" size="sm" onClick={handleAddLineItem}>
                <Plus className="w-4 h-4 mr-1" />
                Add Item
              </Button>
            </div>

            <div className="space-y-3">
              {lineItems.map((item, idx) => (
                <QuoteItemRow
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

            <Button variant="ghost" size="sm" onClick={handleAddLineItem} className="mt-3 text-blue-600 dark:text-blue-400 hover:text-blue-700">
              <Plus className="w-4 h-4 mr-1" />
              Add Line Item
            </Button>
          </div>

          {/* Notes/Terms + Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes for the client..."
                  rows={3}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 resize-none"
                />
              </div>
              <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Terms & Conditions</label>
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
                  <span className="font-medium text-slate-900 dark:text-white">{formatCurrency(calculations.subtotal)}</span>
                </div>
                {calculations.totalDiscount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Total Discount</span>
                    <span>-{formatCurrency(calculations.totalDiscount)}</span>
                  </div>
                )}
                <div className="border-t-2 border-slate-200 dark:border-slate-700 pt-3 flex justify-between">
                  <span className="text-lg font-bold text-slate-900 dark:text-white">Total</span>
                  <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{formatCurrency(calculations.total)}</span>
                </div>
              </div>

              {/* Quick info */}
              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Clock className="w-3.5 h-3.5" />
                  Valid for {validityPeriod === 'custom' ? 'custom period' : `${validityPeriod} days`}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {lineItems.filter((i) => i.productName || i.unitPrice > 0).length} line item(s)
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
