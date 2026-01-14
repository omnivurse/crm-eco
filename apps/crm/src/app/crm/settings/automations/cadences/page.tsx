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
  Timer,
  Plus,
  ArrowLeft,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  Mail,
  Phone,
  CheckSquare,
  GripVertical,
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
import type { CrmCadence, CadenceStep, CadenceStepType } from '@/lib/automation/types';

interface Module {
  id: string;
  key: string;
  name: string;
}

export default function CadencesPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const [cadences, setCadences] = useState<CrmCadence[]>([]);
  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState<Module[]>([]);
  const [orgId, setOrgId] = useState('');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CrmCadence | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    module_id: '',
    name: '',
    description: '',
    is_enabled: true,
    steps: [] as CadenceStep[],
  });

  // Step editor state
  const [stepType, setStepType] = useState<CadenceStepType>('task');
  const [stepDelay, setStepDelay] = useState(1);
  const [stepTitle, setStepTitle] = useState('');

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

      const [modulesRes, cadencesRes] = await Promise.all([
        supabase.from('crm_modules').select('id, key, name').eq('org_id', profile.organization_id).eq('is_enabled', true),
        supabase.from('crm_cadences').select('*').eq('org_id', profile.organization_id),
      ]);

      setModules((modulesRes.data || []) as Module[]);
      setCadences((cadencesRes.data || []) as CrmCadence[]);
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
      steps: [],
    });
    setDialogOpen(true);
  };

  const openEditDialog = (cadence: CrmCadence) => {
    setEditing(cadence);
    setForm({
      module_id: cadence.module_id,
      name: cadence.name,
      description: cadence.description || '',
      is_enabled: cadence.is_enabled,
      steps: cadence.steps,
    });
    setDialogOpen(true);
  };

  const addStep = () => {
    const newStep: CadenceStep = {
      id: crypto.randomUUID(),
      type: stepType,
      delayDays: stepDelay,
      order: form.steps.length,
      config: stepType === 'task' 
        ? { type: 'task', title: stepTitle || 'Follow-up task' }
        : stepType === 'email'
        ? { type: 'email', subject: stepTitle || 'Follow-up email' }
        : stepType === 'call'
        ? { type: 'call', script: stepTitle || 'Call script' }
        : { type: 'wait', days: stepDelay },
    };
    setForm({ ...form, steps: [...form.steps, newStep] });
    setStepTitle('');
    setStepDelay(1);
  };

  const removeStep = (index: number) => {
    setForm({
      ...form,
      steps: form.steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i })),
    });
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
        steps: form.steps,
      };

      if (editing) {
        await supabase.from('crm_cadences').update(data).eq('id', editing.id);
      } else {
        await supabase.from('crm_cadences').insert(data);
      }

      fetchData();
      setDialogOpen(false);
    } catch (error) {
      console.error('Failed to save cadence:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await supabase.from('crm_cadences').delete().eq('id', deleteId);
      setCadences(cadences.filter(c => c.id !== deleteId));
    } catch (error) {
      console.error('Failed to delete:', error);
    } finally {
      setDeleteId(null);
    }
  };

  const getModuleName = (moduleId: string) => modules.find(m => m.id === moduleId)?.name || 'Unknown';

  const stepIcons: Record<CadenceStepType, React.ReactNode> = {
    task: <CheckSquare className="w-4 h-4 text-blue-500" />,
    email: <Mail className="w-4 h-4 text-emerald-500" />,
    call: <Phone className="w-4 h-4 text-amber-500" />,
    wait: <Timer className="w-4 h-4 text-slate-400" />,
  };

  function getStepIcons(steps: CadenceStep[]) {
    return steps.slice(0, 5).map((step, i) => {
      const icons: Record<string, React.ReactNode> = {
        task: <CheckSquare key={i} className="w-4 h-4 text-blue-500" />,
        email: <Mail key={i} className="w-4 h-4 text-emerald-500" />,
        call: <Phone key={i} className="w-4 h-4 text-amber-500" />,
        wait: <Timer key={i} className="w-4 h-4 text-slate-400" />,
      };
      return icons[step.type] || null;
    });
  }

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
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Timer className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Cadences</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Multi-step engagement sequences
              </p>
            </div>
          </div>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Create Cadence
        </Button>
      </div>

      {/* Step Types */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <CheckSquare className="w-5 h-5 text-blue-500" />
            <span className="font-medium text-slate-900 dark:text-white">Task</span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Create a follow-up task
          </p>
        </div>
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <Mail className="w-5 h-5 text-emerald-500" />
            <span className="font-medium text-slate-900 dark:text-white">Email</span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Send an automated email
          </p>
        </div>
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <Phone className="w-5 h-5 text-amber-500" />
            <span className="font-medium text-slate-900 dark:text-white">Call</span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Create a call task
          </p>
        </div>
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <Timer className="w-5 h-5 text-slate-500" />
            <span className="font-medium text-slate-900 dark:text-white">Wait</span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Wait N days before next step
          </p>
        </div>
      </div>

      {/* Cadences Table */}
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : cadences.length === 0 ? (
          <div className="text-center py-12">
            <Timer className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
              No cadences yet
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              Create cadences for automated follow-up sequences
            </p>
            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Create Cadence
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Steps</TableHead>
                <TableHead>Enrollments</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cadences.map((cadence) => (
                <TableRow key={cadence.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">
                        {cadence.name}
                      </div>
                      {cadence.description && (
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          {cadence.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {getModuleName(cadence.module_id)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {cadence.steps.slice(0, 5).map((step, i) => (
                        <span key={i}>{stepIcons[step.type]}</span>
                      ))}
                      {cadence.steps.length > 5 && (
                        <span className="text-sm text-slate-400">+{cadence.steps.length - 5}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-slate-600 dark:text-slate-400">0 active</span>
                  </TableCell>
                  <TableCell>
                    <Switch 
                      checked={cadence.is_enabled}
                      onCheckedChange={async (checked) => {
                        await supabase.from('crm_cadences').update({ is_enabled: checked }).eq('id', cadence.id);
                        setCadences(cadences.map(c => c.id === cadence.id ? { ...c, is_enabled: checked } : c));
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
                        <DropdownMenuItem onClick={() => openEditDialog(cadence)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onClick={() => setDeleteId(cadence.id)}>
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
            <DialogTitle>{editing ? 'Edit' : 'Create'} Cadence</DialogTitle>
            <DialogDescription>
              Build multi-step engagement sequences with tasks, emails, and calls.
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
                <Label>Cadence Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., New Lead Follow-up"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Describe this cadence..."
                rows={2}
              />
            </div>

            {/* Steps List */}
            <div className="space-y-2">
              <Label>Cadence Steps ({form.steps.length})</Label>
              <div className="border rounded-lg overflow-hidden">
                {form.steps.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    No steps defined. Add your first step below.
                  </div>
                ) : (
                  <div className="divide-y">
                    {form.steps.map((step, index) => (
                      <div key={step.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50">
                        <div className="flex items-center gap-3">
                          <GripVertical className="w-4 h-4 text-slate-400" />
                          <span className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 text-xs flex items-center justify-center font-medium">
                            {index + 1}
                          </span>
                          {stepIcons[step.type]}
                          <div className="text-sm">
                            <span className="font-medium capitalize">{step.type}</span>
                            <span className="text-slate-500 ml-2">
                              after {step.delayDays} day{step.delayDays !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => removeStep(index)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Add Step Form */}
            <div className="p-4 border rounded-lg bg-purple-50/50 dark:bg-purple-900/10 space-y-3">
              <Label className="text-sm font-medium">Add Step</Label>
              <div className="grid grid-cols-4 gap-2">
                <Select value={stepType} onValueChange={(v) => setStepType(v as CadenceStepType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="task">
                      <div className="flex items-center gap-2">
                        <CheckSquare className="w-4 h-4 text-blue-500" />
                        Task
                      </div>
                    </SelectItem>
                    <SelectItem value="email">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-emerald-500" />
                        Email
                      </div>
                    </SelectItem>
                    <SelectItem value="call">
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-amber-500" />
                        Call
                      </div>
                    </SelectItem>
                    <SelectItem value="wait">
                      <div className="flex items-center gap-2">
                        <Timer className="w-4 h-4 text-slate-400" />
                        Wait
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={stepDelay}
                    onChange={(e) => setStepDelay(parseInt(e.target.value) || 1)}
                    min={0}
                    className="w-16"
                  />
                  <span className="text-sm text-slate-500">days</span>
                </div>
                <Input
                  value={stepTitle}
                  onChange={(e) => setStepTitle(e.target.value)}
                  placeholder={stepType === 'wait' ? '(auto)' : 'Title/Subject'}
                  disabled={stepType === 'wait'}
                />
                <Button variant="outline" onClick={addStep}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
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
              {editing ? 'Save Changes' : 'Create Cadence'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Cadence</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this cadence? Active enrollments will be cancelled.
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
