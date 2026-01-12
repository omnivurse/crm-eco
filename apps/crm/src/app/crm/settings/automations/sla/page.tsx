'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from '@crm-eco/ui/components/button';
import { Switch } from '@crm-eco/ui/components/switch';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { Textarea } from '@crm-eco/ui/components/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@crm-eco/ui/components/table';
import { Badge } from '@crm-eco/ui/components/badge';
import {
  Clock,
  Plus,
  ArrowLeft,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@crm-eco/ui/components/alert-dialog';
import type { CrmSlaPolicy } from '@/lib/automation/types';

interface Module {
  id: string;
  key: string;
  name: string;
}

export default function SLAPoliciesPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const [policies, setPolicies] = useState<CrmSlaPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState<Module[]>([]);
  const [orgId, setOrgId] = useState('');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CrmSlaPolicy | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    module_id: '',
    name: '',
    description: '',
    is_enabled: true,
    responseHours: 24,
    escalationHours: 48,
  });

  const fetchData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();
      
      if (!profile) return;
      setOrgId(profile.organization_id);

      const [modulesRes, policiesRes] = await Promise.all([
        supabase.from('crm_modules').select('id, key, name').eq('org_id', profile.organization_id).eq('is_enabled', true),
        supabase.from('crm_sla_policies').select('*').eq('org_id', profile.organization_id),
      ]);

      setModules((modulesRes.data || []) as Module[]);
      setPolicies((policiesRes.data || []) as CrmSlaPolicy[]);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreateDialog = () => {
    setEditing(null);
    setForm({
      module_id: modules[0]?.id || '',
      name: '',
      description: '',
      is_enabled: true,
      responseHours: 24,
      escalationHours: 48,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (policy: CrmSlaPolicy) => {
    setEditing(policy);
    setForm({
      module_id: policy.module_id,
      name: policy.name,
      description: policy.description || '',
      is_enabled: policy.is_enabled,
      responseHours: policy.config.responseHours,
      escalationHours: policy.config.escalations?.[0]?.afterHours || 48,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = {
        org_id: orgId,
        module_id: form.module_id,
        name: form.name,
        description: form.description || null,
        is_enabled: form.is_enabled,
        config: {
          responseHours: form.responseHours,
          escalations: [
            { afterHours: form.escalationHours, notifyUsers: [] }
          ],
        },
      };

      if (editing) {
        await supabase.from('crm_sla_policies').update(data).eq('id', editing.id);
      } else {
        await supabase.from('crm_sla_policies').insert(data);
      }

      fetchData();
      setDialogOpen(false);
    } catch (error) {
      console.error('Failed to save policy:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await supabase.from('crm_sla_policies').delete().eq('id', deleteId);
      setPolicies(policies.filter(p => p.id !== deleteId));
    } catch (error) {
      console.error('Failed to delete:', error);
    } finally {
      setDeleteId(null);
    }
  };

  const getModuleName = (moduleId: string) => modules.find(m => m.id === moduleId)?.name || 'Unknown';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/crm/settings/automations">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-500/10 rounded-lg">
              <Clock className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">SLA Policies</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Set response times and escalation rules
              </p>
            </div>
          </div>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Create Policy
        </Button>
      </div>

      {/* SLA Overview */}
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          How SLA Policies Work
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-green-500" />
              <span className="font-medium text-green-700 dark:text-green-300">Response Time</span>
            </div>
            <p className="text-sm text-green-600 dark:text-green-400">
              Define target response times for new records
            </p>
          </div>
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <span className="font-medium text-amber-700 dark:text-amber-300">Escalation</span>
            </div>
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Escalate to managers when SLA is at risk
            </p>
          </div>
          <div className="p-4 bg-rose-50 dark:bg-rose-900/20 rounded-lg border border-rose-200 dark:border-rose-800">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-rose-500" />
              <span className="font-medium text-rose-700 dark:text-rose-300">Breach</span>
            </div>
            <p className="text-sm text-rose-600 dark:text-rose-400">
              Track and report on SLA breaches
            </p>
          </div>
        </div>
      </div>

      {/* Policies Table */}
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : policies.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
              No SLA policies yet
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              Create policies to track response times and escalations
            </p>
            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Create Policy
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Response Time</TableHead>
                <TableHead>Escalations</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policies.map((policy) => (
                <TableRow key={policy.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">
                        {policy.name}
                      </div>
                      {policy.description && (
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          {policy.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {getModuleName(policy.module_id)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {policy.config.responseHours}h
                  </TableCell>
                  <TableCell>
                    {policy.config.escalations?.length || 0} level{policy.config.escalations?.length !== 1 ? 's' : ''}
                  </TableCell>
                  <TableCell>
                    <Switch 
                      checked={policy.is_enabled}
                      onCheckedChange={async (checked) => {
                        await supabase.from('crm_sla_policies').update({ is_enabled: checked }).eq('id', policy.id);
                        setPolicies(policies.map(p => p.id === policy.id ? { ...p, is_enabled: checked } : p));
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(policy)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onClick={() => setDeleteId(policy.id)}>
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit' : 'Create'} SLA Policy</DialogTitle>
            <DialogDescription>
              Set response times and escalation rules for records.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Module</Label>
              <Select value={form.module_id} onValueChange={(v) => setForm({ ...form, module_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select module" />
                </SelectTrigger>
                <SelectContent>
                  {modules.map((mod) => (
                    <SelectItem key={mod.id} value={mod.id}>{mod.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Policy Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Standard Response SLA"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Describe this SLA policy..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-green-500" />
                  Response Time (hours)
                </Label>
                <Input
                  type="number"
                  value={form.responseHours}
                  onChange={(e) => setForm({ ...form, responseHours: parseInt(e.target.value) || 24 })}
                  min={1}
                />
                <p className="text-xs text-slate-500">Target response time</p>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Escalation Time (hours)
                </Label>
                <Input
                  type="number"
                  value={form.escalationHours}
                  onChange={(e) => setForm({ ...form, escalationHours: parseInt(e.target.value) || 48 })}
                  min={1}
                />
                <p className="text-xs text-slate-500">Time before escalation</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_enabled}
                onCheckedChange={(checked) => setForm({ ...form, is_enabled: checked })}
              />
              <Label>{form.is_enabled ? 'Enabled' : 'Disabled'}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name || !form.module_id}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {editing ? 'Save Changes' : 'Create Policy'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete SLA Policy</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this SLA policy? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
