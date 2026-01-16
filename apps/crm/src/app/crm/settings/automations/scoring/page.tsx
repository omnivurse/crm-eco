'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from '@crm-eco/ui/components/button';
import { Switch } from '@crm-eco/ui/components/switch';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
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
  Star,
  Plus,
  ArrowLeft,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  RefreshCw,
  X,
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
import type { CrmScoringRules, ScoringRule, ConditionOperator } from '@/lib/automation/types';

interface Module {
  id: string;
  key: string;
  name: string;
}

interface Field {
  id: string;
  key: string;
  label: string;
  type: string;
}

const OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: 'eq', label: 'Equals' },
  { value: 'ne', label: 'Not equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'gt', label: 'Greater than' },
  { value: 'gte', label: 'Greater than or equal' },
  { value: 'lt', label: 'Less than' },
  { value: 'lte', label: 'Less than or equal' },
  { value: 'not_empty', label: 'Has value' },
  { value: 'is_empty', label: 'Is empty' },
];

export default function ScoringRulesPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const [scoringRules, setScoringRules] = useState<CrmScoringRules[]>([]);
  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState<Module[]>([]);
  const [fields, setFields] = useState<Record<string, Field[]>>({});
  const [orgId, setOrgId] = useState('');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CrmScoringRules | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    module_id: '',
    name: '',
    is_enabled: true,
    score_field_key: 'score',
    rules: [] as ScoringRule[],
  });

  // New rule state
  const [newRule, setNewRule] = useState({ field: '', operator: 'eq' as ConditionOperator, value: '', points: 10 });

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

      const [modulesRes, rulesRes] = await Promise.all([
        supabase.from('crm_modules').select('id, key, name').eq('org_id', profile.organization_id).eq('is_enabled', true),
        supabase.from('crm_scoring_rules').select('*').eq('org_id', profile.organization_id),
      ]);

      setModules((modulesRes.data || []) as Module[]);
      setScoringRules((rulesRes.data || []) as CrmScoringRules[]);

      // Load fields for each module
      const fieldsByModule: Record<string, Field[]> = {};
      for (const mod of modulesRes.data || []) {
        const { data: moduleFields } = await supabase
          .from('crm_fields')
          .select('id, key, label, type')
          .eq('module_id', mod.id);
        fieldsByModule[mod.id] = (moduleFields || []) as Field[];
      }
      setFields(fieldsByModule);
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
      is_enabled: true,
      score_field_key: 'score',
      rules: [],
    });
    setDialogOpen(true);
  };

  const openEditDialog = (scoring: CrmScoringRules) => {
    setEditing(scoring);
    setForm({
      module_id: scoring.module_id,
      name: scoring.name,
      is_enabled: scoring.is_enabled,
      score_field_key: scoring.score_field_key,
      rules: scoring.rules,
    });
    setDialogOpen(true);
  };

  const addRule = () => {
    if (!newRule.field) return;
    setForm({
      ...form,
      rules: [...form.rules, newRule],
    });
    setNewRule({ field: '', operator: 'eq', value: '', points: 10 });
  };

  const removeRule = (index: number) => {
    setForm({
      ...form,
      rules: form.rules.filter((_, i) => i !== index),
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = {
        org_id: orgId,
        module_id: form.module_id,
        name: form.name,
        is_enabled: form.is_enabled,
        score_field_key: form.score_field_key,
        rules: form.rules,
      };

      if (editing) {
        await supabase.from('crm_scoring_rules').update(data).eq('id', editing.id);
      } else {
        await supabase.from('crm_scoring_rules').insert(data);
      }

      fetchData();
      setDialogOpen(false);
    } catch (error) {
      console.error('Failed to save scoring rules:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await supabase.from('crm_scoring_rules').delete().eq('id', deleteId);
      setScoringRules(scoringRules.filter(r => r.id !== deleteId));
    } catch (error) {
      console.error('Failed to delete:', error);
    } finally {
      setDeleteId(null);
    }
  };

  const getModuleName = (moduleId: string) => modules.find(m => m.id === moduleId)?.name || 'Unknown';
  const getModuleFields = () => fields[form.module_id] || [];
  const getFieldLabel = (key: string) => getModuleFields().find(f => f.key === key)?.label || key;

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
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <Star className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Scoring Rules</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Score records based on field values
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Recalculate All
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Create Scoring Rules
          </Button>
        </div>
      </div>

      {/* Example Scoring Logic */}
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          How Scoring Works
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-5 h-5 text-amber-500" />
              <span className="font-medium text-slate-900 dark:text-white">+10 points</span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Status is "Hot Lead"
            </p>
          </div>
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-5 h-5 text-amber-500" />
              <span className="font-medium text-slate-900 dark:text-white">+5 points</span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Has email address
            </p>
          </div>
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-5 h-5 text-amber-500" />
              <span className="font-medium text-slate-900 dark:text-white">+15 points</span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Budget over $10,000
            </p>
          </div>
        </div>
      </div>

      {/* Scoring Rules Table */}
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : scoringRules.length === 0 ? (
          <div className="text-center py-12">
            <Star className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
              No scoring rules yet
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              Create rules to score your leads and records
            </p>
            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Create Scoring Rules
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Rules</TableHead>
                <TableHead>Score Field</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scoringRules.map((scoring) => (
                <TableRow key={scoring.id}>
                  <TableCell className="font-medium text-slate-900 dark:text-white">
                    {scoring.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {getModuleName(scoring.module_id)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {scoring.rules.length} rule{scoring.rules.length !== 1 ? 's' : ''}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {scoring.score_field_key}
                  </TableCell>
                  <TableCell>
                    <Switch 
                      checked={scoring.is_enabled}
                      onCheckedChange={async (checked) => {
                        await supabase.from('crm_scoring_rules').update({ is_enabled: checked }).eq('id', scoring.id);
                        setScoringRules(scoringRules.map(r => r.id === scoring.id ? { ...r, is_enabled: checked } : r));
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
                        <DropdownMenuItem onClick={() => openEditDialog(scoring)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onClick={() => setDeleteId(scoring.id)}>
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
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit' : 'Create'} Scoring Rules</DialogTitle>
            <DialogDescription>
              Define rules to automatically calculate scores for records based on field values.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
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
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Lead Scoring"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Score Field Key</Label>
              <Input
                value={form.score_field_key}
                onChange={(e) => setForm({ ...form, score_field_key: e.target.value })}
                placeholder="score"
              />
              <p className="text-xs text-slate-500">The field where the calculated score will be stored</p>
            </div>

            {/* Rules List */}
            <div className="space-y-2">
              <Label>Scoring Rules</Label>
              <div className="border rounded-lg overflow-hidden">
                {form.rules.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    No rules defined. Add your first rule below.
                  </div>
                ) : (
                  <div className="divide-y">
                    {form.rules.map((rule, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">{getFieldLabel(rule.field)}</span>
                          <span className="text-slate-500">{OPERATORS.find(o => o.value === rule.operator)?.label}</span>
                          <span className="font-mono">{String(rule.value)}</span>
                          <span className="text-teal-600 dark:text-teal-400 font-bold">→ +{rule.points} pts</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => removeRule(index)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Add Rule Form */}
            <div className="p-4 border rounded-lg bg-amber-50/50 dark:bg-amber-900/10 space-y-3">
              <Label className="text-sm font-medium">Add Rule</Label>
              <div className="grid grid-cols-4 gap-2">
                <Select value={newRule.field} onValueChange={(v) => setNewRule({ ...newRule, field: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Field" />
                  </SelectTrigger>
                  <SelectContent>
                    {getModuleFields().map((field) => (
                      <SelectItem key={field.key} value={field.key}>{field.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={newRule.operator} onValueChange={(v) => setNewRule({ ...newRule, operator: v as ConditionOperator })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Operator" />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map((op) => (
                      <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={newRule.value}
                  onChange={(e) => setNewRule({ ...newRule, value: e.target.value })}
                  placeholder="Value"
                />
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={newRule.points}
                    onChange={(e) => setNewRule({ ...newRule, points: parseInt(e.target.value) || 0 })}
                    className="w-20"
                  />
                  <Button variant="outline" size="sm" onClick={addRule} disabled={!newRule.field}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
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
              {editing ? 'Save Changes' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Scoring Rules</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete these scoring rules? This action cannot be undone.
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
