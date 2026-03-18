'use client';

import { useState, useCallback } from 'react';
import { Badge, Button, Input } from '@crm-eco/ui';
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@crm-eco/ui/components/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import {
  Plus, Search, MoreHorizontal, Pencil, Archive, RotateCcw,
  Heart, Shield, Building2, Globe, Phone, Mail,
} from 'lucide-react';
import { toast } from 'sonner';
import { createBrowserClient } from '@crm-eco/lib/supabase/client';
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
  organization_id: string;
  created_at: string;
}

const CARRIER_TYPES = [
  { value: 'insurance', label: 'Insurance', icon: Shield, color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30' },
  { value: 'healthshare', label: 'HealthShare', icon: Heart, color: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30' },
  { value: 'medicaid', label: 'Medicaid', icon: Building2, color: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/20 dark:text-violet-400 dark:border-violet-500/30' },
  { value: 'short_term', label: 'Short Term', icon: Shield, color: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30' },
];

const emptyForm = { carrier_name: '', naic_code: '', website: '', phone: '', email: '', carrier_type: 'insurance' };

interface Props {
  initialCarriers: Carrier[];
  orgId: string;
}

export function CarrierManagement({ initialCarriers, orgId }: Props) {
  const [carriers, setCarriers] = useState<Carrier[]>(initialCarriers);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCarrier, setEditingCarrier] = useState<Carrier | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const supabase = createBrowserClient();

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from('insurance_carriers')
      .select('*')
      .eq('organization_id', orgId)
      .order('carrier_name');
    if (data) setCarriers(data);
  }, [orgId, supabase]);

  const handleSave = async () => {
    if (!form.carrier_name.trim()) { toast.error('Name required'); return; }
    setSaving(true);
    try {
      if (editingCarrier) {
        const { error } = await supabase.from('insurance_carriers').update(form).eq('id', editingCarrier.id);
        if (error) throw error;
        toast.success('Carrier updated');
      } else {
        const { error } = await supabase.from('insurance_carriers').insert({ ...form, organization_id: orgId });
        if (error) throw error;
        toast.success('Carrier created');
      }
      setDialogOpen(false);
      setEditingCarrier(null);
      setForm(emptyForm);
      refresh();
    } catch (err: any) {
      toast.error(err.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleArchive = async (c: Carrier) => {
    const { error } = await supabase.from('insurance_carriers').update({ is_active: false }).eq('id', c.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`${c.carrier_name} archived`);
    refresh();
  };

  const handleReactivate = async (c: Carrier) => {
    const { error } = await supabase.from('insurance_carriers').update({ is_active: true }).eq('id', c.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`${c.carrier_name} reactivated`);
    refresh();
  };

  const openEdit = (c: Carrier) => {
    setEditingCarrier(c);
    setForm({ carrier_name: c.carrier_name, naic_code: c.naic_code || '', website: c.website || '', phone: c.phone || '', email: c.email || '', carrier_type: c.carrier_type });
    setDialogOpen(true);
  };

  const filtered = carriers.filter(c => {
    if (!showArchived && !c.is_active) return false;
    if (showArchived && c.is_active) return false;
    if (typeFilter !== 'all' && c.carrier_type !== typeFilter) return false;
    if (search && !c.carrier_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const typeConfig = (t: string) => CARRIER_TYPES.find(ct => ct.value === t) || CARRIER_TYPES[0];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Search carriers..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40 h-9"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {CARRIER_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant={showArchived ? 'default' : 'outline'} size="sm" onClick={() => setShowArchived(!showArchived)} className="h-9">
          <Archive className="w-4 h-4 mr-1.5" />{showArchived ? 'Active' : 'Archived'}
        </Button>
        <Button size="sm" onClick={() => { setEditingCarrier(null); setForm(emptyForm); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-1.5" />Add Carrier
        </Button>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">{showArchived ? 'No archived carriers' : 'No carriers found'}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(carrier => {
              const tc = typeConfig(carrier.carrier_type);
              return (
                <div key={carrier.id} className={cn('flex items-center gap-4 px-4 py-3 hover:bg-slate-50', !carrier.is_active && 'opacity-60')}>
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <tc.icon className="w-5 h-5 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-slate-900 truncate">{carrier.carrier_name}</span>
                      <Badge variant="outline" className={cn('text-xs px-1.5 py-0', tc.color)}>{tc.label}</Badge>
                      {!carrier.is_active && <Badge variant="outline" className="text-xs px-1.5 py-0 text-slate-400">Archived</Badge>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                      {carrier.naic_code && <span>NAIC: {carrier.naic_code}</span>}
                      {carrier.website && <a href={carrier.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-blue-500"><Globe className="w-3 h-3" />Website</a>}
                      {carrier.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{carrier.phone}</span>}
                      {carrier.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{carrier.email}</span>}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(carrier)}><Pencil className="w-4 h-4 mr-2" />Edit</DropdownMenuItem>
                      {carrier.is_active
                        ? <DropdownMenuItem onClick={() => handleArchive(carrier)} className="text-amber-600"><Archive className="w-4 h-4 mr-2" />Archive</DropdownMenuItem>
                        : <DropdownMenuItem onClick={() => handleReactivate(carrier)} className="text-emerald-600"><RotateCcw className="w-4 h-4 mr-2" />Reactivate</DropdownMenuItem>
                      }
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingCarrier ? 'Edit Carrier' : 'Add Carrier'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><label className="text-sm font-medium mb-1 block">Name *</label><Input value={form.carrier_name} onChange={e => setForm(f => ({ ...f, carrier_name: e.target.value }))} /></div>
            <div><label className="text-sm font-medium mb-1 block">Type</label>
              <Select value={form.carrier_type} onValueChange={v => setForm(f => ({ ...f, carrier_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CARRIER_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium mb-1 block">NAIC Code</label><Input value={form.naic_code} onChange={e => setForm(f => ({ ...f, naic_code: e.target.value }))} /></div>
              <div><label className="text-sm font-medium mb-1 block">Phone</label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            </div>
            <div><label className="text-sm font-medium mb-1 block">Website</label><Input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} /></div>
            <div><label className="text-sm font-medium mb-1 block">Email</label><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : editingCarrier ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
