'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDebouncedValue } from '@/hooks/useDebouncedSearch';
import Link from 'next/link';
import { CarrierContactsPanel } from '@/components/crm/carriers/CarrierContactsPanel';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Badge } from '@crm-eco/ui/components/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@crm-eco/ui/components/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Archive,
  RotateCcw,
  Heart,
  Shield,
  Building2,
  Globe,
  Phone,
  Mail,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@crm-eco/ui/lib/utils';

/** Only allow in-app CRM relative paths (blocks open redirects). */
function safeCrmReturnPath(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  if (!raw.startsWith('/crm/')) return null;
  return raw;
}

interface Carrier {
  id: string;
  carrier_name: string;
  naic_code: string | null;
  website: string | null;
  logo_url: string | null;
  carrier_type: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
}

const CARRIER_TYPES = [
  { value: 'insurance', label: 'Insurance', icon: Shield, color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30' },
  { value: 'healthshare', label: 'Health Sharing Ministry', icon: Heart, color: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30' },
  { value: 'medicaid', label: 'Medicaid', icon: Building2, color: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/20 dark:text-violet-400 dark:border-violet-500/30' },
  { value: 'short_term', label: 'Short Term', icon: Shield, color: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30' },
];

const emptyForm = {
  carrier_name: '',
  naic_code: '',
  website: '',
  phone: '',
  email: '',
  carrier_type: 'insurance',
};

/**
 * Read an API error body into a display string. Server error payloads can be a
 * string, a Zod issue array, or an object — coerce them all to text so a toast
 * never shows "[object Object]".
 */
async function readApiError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  const raw = (body as { error?: unknown } | null)?.error;
  if (typeof raw === 'string') return raw || fallback;
  if (Array.isArray(raw)) {
    const msg = raw
      .map((e) =>
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message: unknown }).message)
          : String(e),
      )
      .filter(Boolean)
      .join('; ');
    return msg || fallback;
  }
  if (raw && typeof raw === 'object' && 'message' in raw) {
    return String((raw as { message: unknown }).message) || fallback;
  }
  return fallback;
}

export default function CarrierManagementPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading…</div>}>
      <CarrierManagementContent />
    </Suspense>
  );
}

function CarrierManagementContent() {
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCarrier, setEditingCarrier] = useState<Carrier | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = safeCrmReturnPath(searchParams.get('returnTo'));

  // Context-aware terminology: 'Ministry' for healthshare, 'Carrier' for everything else
  const activeType = editingCarrier?.carrier_type ?? form.carrier_type;
  const isMinistry = (type: string) => type === 'healthshare';
  const termForType = (type: string) => isMinistry(type) ? 'Ministry' : 'Carrier';
  const addButtonLabel = typeFilter === 'healthshare' ? 'Add Ministry' : typeFilter === 'all' ? 'Add Carrier / Ministry' : 'Add Carrier';

  // Debounced — the raw `search` state changes per keystroke and this fetch
  // pulls up to 500 rows; refetching per character made the box feel sluggish.
  const debouncedSearch = useDebouncedValue(search, 300);

  const fetchCarriers = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (typeFilter !== 'all') params.set('carrier_type', typeFilter);
      // Fetch active + optionally archived
      const res = await fetch(`/api/crm/carriers?${params.toString()}&limit=500`);
      const data = await res.json();
      // The API returns `{ data: [...], total }`; tolerate a bare array or a
      // legacy `{ carriers }` shape too so the list always populates.
      const list = Array.isArray(data)
        ? data
        : (data?.data ?? data?.carriers ?? []);
      setCarriers(Array.isArray(list) ? list : []);
    } catch {
      toast.error('Failed to load carriers');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, typeFilter]);

  useEffect(() => { fetchCarriers(); }, [fetchCarriers]);

  /** Drop blank optional fields so create/update don't send "" for URL/email. */
  const payloadFromForm = () => {
    const out: Record<string, unknown> = {
      carrier_name: form.carrier_name.trim(),
      carrier_type: form.carrier_type,
    };
    for (const key of ['naic_code', 'website', 'phone', 'email'] as const) {
      const v = form[key].trim();
      if (v) out[key] = v;
      else if (editingCarrier) out[key] = null; // clear on edit
    }
    return out;
  };

  const handleSave = async () => {
    if (!form.carrier_name.trim()) {
      toast.error('Carrier name is required');
      return;
    }
    setSaving(true);
    try {
      const body = payloadFromForm();
      if (editingCarrier) {
        const res = await fetch(`/api/crm/carriers/${editingCarrier.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(await readApiError(res, 'Update failed'));
        toast.success(`${termForType(editingCarrier.carrier_type)} updated`);
        setDialogOpen(false);
        setEditingCarrier(null);
        setForm(emptyForm);
        fetchCarriers();
      } else {
        const res = await fetch('/api/crm/carriers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(await readApiError(res, 'Create failed'));
        toast.success(`${termForType(form.carrier_type)} created`);
        setDialogOpen(false);
        setEditingCarrier(null);
        setForm(emptyForm);
        // Return to the member/record the user was editing (if they arrived via returnTo).
        if (returnTo) {
          router.push(returnTo);
          return;
        }
        fetchCarriers();
      }
    } catch (err) {
      const message =
        err instanceof Error && err.message && err.message !== '[object Object]'
          ? err.message
          : 'Save failed';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (carrier: Carrier) => {
    try {
      const res = await fetch(`/api/crm/carriers/${carrier.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await readApiError(res, 'Archive failed'));
      toast.success(`${carrier.carrier_name} archived`);
      fetchCarriers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Archive failed');
    }
  };

  const handleReactivate = async (carrier: Carrier) => {
    try {
      const res = await fetch(`/api/crm/carriers/${carrier.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: true }),
      });
      if (!res.ok) throw new Error(await readApiError(res, 'Reactivate failed'));
      toast.success(`${carrier.carrier_name} reactivated`);
      fetchCarriers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reactivate failed');
    }
  };

  const openEdit = (carrier: Carrier) => {
    setEditingCarrier(carrier);
    setForm({
      carrier_name: carrier.carrier_name,
      naic_code: carrier.naic_code || '',
      website: carrier.website || '',
      phone: carrier.phone || '',
      email: carrier.email || '',
      carrier_type: carrier.carrier_type,
    });
    setDialogOpen(true);
  };

  const openCreate = () => {
    setEditingCarrier(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const filtered = carriers.filter(c => {
    if (!showArchived && !c.is_active) return false;
    if (showArchived && c.is_active) return false;
    return true;
  });

  const typeConfig = (type: string) => CARRIER_TYPES.find(t => t.value === type) || CARRIER_TYPES[0];

  return (
    <div className="space-y-6">
      {/* Back-to-record banner when navigated from a Contact/Lead */}
      {returnTo && (
        <div className="flex items-center gap-3 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 dark:border-teal-700/40 dark:bg-teal-500/10">
          <Link
            href={returnTo}
            className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-teal-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Record
          </Link>
          <span className="text-sm text-teal-700 dark:text-teal-300">
            Add carriers here, then go back to finish editing your record.
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Carrier & Ministry Directory</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage insurance carriers and health sharing ministries
          </p>
        </div>
        <Button size="sm" onClick={openCreate} >
          <Plus className="w-4 h-4 mr-1.5" />
          {addButtonLabel}
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search carriers..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44 h-9">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {CARRIER_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={showArchived ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowArchived(!showArchived)}
          className="h-9"
        >
          <Archive className="w-4 h-4 mr-1.5" />
          {showArchived ? 'Show Active' : 'Show Archived'}
        </Button>
      </div>

      {/* Carrier List */}
      <div className="glass-card rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading carriers...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {showArchived ? 'No archived carriers' : 'No carriers found'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {showArchived ? 'Archived carriers will appear here' : 'Add your first carrier to get started'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {filtered.map(carrier => {
              const tc = typeConfig(carrier.carrier_type);
              return (
                <div key={carrier.id} className={cn(
                  'flex items-center gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors',
                  !carrier.is_active && 'opacity-60',
                )}>
                  <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                    <tc.icon className="w-5 h-5 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-slate-900 dark:text-white truncate">
                        {carrier.carrier_name}
                      </span>
                      <Badge variant="outline" className={cn('text-xs px-1.5 py-0', tc.color)}>
                        {tc.label}
                      </Badge>
                      {!carrier.is_active && (
                        <Badge variant="outline" className="text-xs px-1.5 py-0 bg-slate-100 text-slate-500 border-slate-200">
                          Archived
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                      {carrier.naic_code && <span>NAIC: {carrier.naic_code}</span>}
                      {carrier.website && (
                        <a href={carrier.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-teal-500">
                          <Globe className="w-3 h-3" /> Website
                        </a>
                      )}
                      {carrier.phone && (
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{carrier.phone}</span>
                      )}
                      {carrier.email && (
                        <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{carrier.email}</span>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-700">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
                      <DropdownMenuItem onClick={() => openEdit(carrier)} className="cursor-pointer">
                        <Pencil className="w-4 h-4 mr-2" /> Edit
                      </DropdownMenuItem>
                      {carrier.is_active ? (
                        <DropdownMenuItem onClick={() => handleArchive(carrier)} className="cursor-pointer text-amber-600">
                          <Archive className="w-4 h-4 mr-2" /> Archive
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => handleReactivate(carrier)} className="cursor-pointer text-emerald-600">
                          <RotateCcw className="w-4 h-4 mr-2" /> Reactivate
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-white">
              {editingCarrier ? `Edit ${termForType(editingCarrier.carrier_type)}` : `Add ${termForType(form.carrier_type)}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Name *</label>
              <Input value={form.carrier_name} onChange={e => setForm(f => ({ ...f, carrier_name: e.target.value }))} placeholder="Carrier name" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Type</label>
              <Select value={form.carrier_type} onValueChange={v => setForm(f => ({ ...f, carrier_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CARRIER_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">NAIC Code</label>
                <Input value={form.naic_code} onChange={e => setForm(f => ({ ...f, naic_code: e.target.value }))} placeholder="Optional" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Phone</label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Optional" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Website</label>
              <Input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://..." />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Email</label>
              <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="contact@carrier.com" />
            </div>
          </div>

          {/* Contacts & Credentials — only when editing an existing carrier */}
          {editingCarrier && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
              <CarrierContactsPanel carrierId={editingCarrier.id} />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editingCarrier ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
