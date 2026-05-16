'use client';

import { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@crm-eco/ui/lib/utils';

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
  { value: 'healthshare', label: 'HealthShare', icon: Heart, color: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30' },
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

export default function CarrierManagementPage() {
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCarrier, setEditingCarrier] = useState<Carrier | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchCarriers = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (typeFilter !== 'all') params.set('carrier_type', typeFilter);
      // Fetch active + optionally archived
      const res = await fetch(`/api/crm/carriers?${params.toString()}&limit=500`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setCarriers(data);
      } else if (data.carriers) {
        setCarriers(data.carriers);
      }
    } catch {
      toast.error('Failed to load carriers');
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter]);

  useEffect(() => { fetchCarriers(); }, [fetchCarriers]);

  const handleSave = async () => {
    if (!form.carrier_name.trim()) {
      toast.error('Carrier name is required');
      return;
    }
    setSaving(true);
    try {
      if (editingCarrier) {
        const res = await fetch(`/api/crm/carriers/${editingCarrier.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        toast.success('Carrier updated');
      } else {
        const res = await fetch('/api/crm/carriers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        toast.success('Carrier created');
      }
      setDialogOpen(false);
      setEditingCarrier(null);
      setForm(emptyForm);
      fetchCarriers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (carrier: Carrier) => {
    try {
      const res = await fetch(`/api/crm/carriers/${carrier.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
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
      if (!res.ok) throw new Error((await res.json()).error);
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Carrier Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage insurance carriers and HealthShare programs
          </p>
        </div>
        <Button size="sm" onClick={openCreate} className="bg-gradient-to-r from-teal-500 to-emerald-500 text-white">
          <Plus className="w-4 h-4 mr-1.5" />
          Add Carrier
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
              {editingCarrier ? 'Edit Carrier' : 'Add Carrier'}
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
