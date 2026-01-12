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
  UserCheck,
  Plus,
  ArrowLeft,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  Users,
  MapPin,
  Scale,
  User,
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
import type { CrmAssignmentRule, AssignmentStrategy, RoundRobinConfig, FixedConfig } from '@/lib/automation/types';

interface CrmUser {
  id: string;
  display_name: string;
  email: string;
}

interface Module {
  id: string;
  key: string;
  name: string;
}

export default function AssignmentRulesPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const [rules, setRules] = useState<CrmAssignmentRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState<Module[]>([]);
  const [users, setUsers] = useState<CrmUser[]>([]);
  const [orgId, setOrgId] = useState('');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<CrmAssignmentRule | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    module_id: '',
    name: '',
    strategy: 'round_robin' as AssignmentStrategy,
    is_enabled: true,
    priority: 100,
    selectedUsers: [] as string[],
    fixedUserId: '',
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

      // Fetch modules, rules, and users in parallel
      const [modulesRes, rulesRes, usersRes] = await Promise.all([
        supabase.from('crm_modules').select('id, key, name').eq('org_id', profile.organization_id).eq('is_enabled', true),
        supabase.from('crm_assignment_rules').select('*').eq('org_id', profile.organization_id).order('priority'),
        supabase.from('profiles').select('id, display_name, email').eq('organization_id', profile.organization_id),
      ]);

      setModules((modulesRes.data || []) as Module[]);
      setRules((rulesRes.data || []) as CrmAssignmentRule[]);
      setUsers((usersRes.data || []) as CrmUser[]);
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
    setEditingRule(null);
    setForm({
      module_id: modules[0]?.id || '',
      name: '',
      strategy: 'round_robin',
      is_enabled: true,
      priority: 100,
      selectedUsers: [],
      fixedUserId: '',
    });
    setDialogOpen(true);
  };

  const openEditDialog = (rule: CrmAssignmentRule) => {
    setEditingRule(rule);
    const config = rule.config as RoundRobinConfig | FixedConfig;
    setForm({
      module_id: rule.module_id,
      name: rule.name,
      strategy: rule.strategy,
      is_enabled: rule.is_enabled,
      priority: rule.priority,
      selectedUsers: 'userIds' in config ? config.userIds : [],
      fixedUserId: 'userId' in config ? config.userId : '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const config = form.strategy === 'fixed'
        ? { userId: form.fixedUserId }
        : form.strategy === 'round_robin'
        ? { userIds: form.selectedUsers, currentIndex: 0 }
        : form.strategy === 'least_loaded'
        ? { userIds: form.selectedUsers }
        : {};

      const data = {
        org_id: orgId,
        module_id: form.module_id,
        name: form.name,
        strategy: form.strategy,
        config,
        conditions: [],
        is_enabled: form.is_enabled,
        priority: form.priority,
      };

      if (editingRule) {
        await supabase.from('crm_assignment_rules').update(data).eq('id', editingRule.id);
      } else {
        await supabase.from('crm_assignment_rules').insert(data);
      }

      fetchData();
      setDialogOpen(false);
    } catch (error) {
      console.error('Failed to save rule:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await supabase.from('crm_assignment_rules').delete().eq('id', deleteId);
      setRules(rules.filter(r => r.id !== deleteId));
    } catch (error) {
      console.error('Failed to delete rule:', error);
    } finally {
      setDeleteId(null);
    }
  };

  const toggleUser = (userId: string) => {
    setForm(prev => ({
      ...prev,
      selectedUsers: prev.selectedUsers.includes(userId)
        ? prev.selectedUsers.filter(id => id !== userId)
        : [...prev.selectedUsers, userId],
    }));
  };

  const getModuleName = (moduleId: string) => modules.find(m => m.id === moduleId)?.name || 'Unknown';

  const strategyIcons: Record<string, React.ReactNode> = {
    round_robin: <Users className="w-4 h-4" />,
    territory: <MapPin className="w-4 h-4" />,
    least_loaded: <Scale className="w-4 h-4" />,
    fixed: <User className="w-4 h-4" />,
  };

  const strategyLabels: Record<string, string> = {
    round_robin: 'Round Robin',
    territory: 'Territory',
    least_loaded: 'Least Loaded',
    fixed: 'Fixed Owner',
  };

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
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <UserCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Assignment Rules</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Automatically assign record owners
              </p>
            </div>
          </div>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Create Rule
        </Button>
      </div>

      {/* Strategy Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-5 h-5 text-blue-500" />
            <span className="font-medium text-slate-900 dark:text-white">Round Robin</span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Distribute evenly among team members
          </p>
        </div>
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <MapPin className="w-5 h-5 text-emerald-500" />
            <span className="font-medium text-slate-900 dark:text-white">Territory</span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Assign based on location or region
          </p>
        </div>
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <Scale className="w-5 h-5 text-amber-500" />
            <span className="font-medium text-slate-900 dark:text-white">Least Loaded</span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Assign to user with fewest open records
          </p>
        </div>
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <User className="w-5 h-5 text-purple-500" />
            <span className="font-medium text-slate-900 dark:text-white">Fixed Owner</span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Always assign to a specific user
          </p>
        </div>
      </div>

      {/* Rules Table */}
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-12">
            <UserCheck className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
              No assignment rules yet
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              Create rules to automatically assign owners to records
            </p>
            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Create Rule
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Strategy</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium text-slate-900 dark:text-white">
                    {rule.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {getModuleName(rule.module_id)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {strategyIcons[rule.strategy]}
                      <span>{strategyLabels[rule.strategy]}</span>
                    </div>
                  </TableCell>
                  <TableCell>{rule.priority}</TableCell>
                  <TableCell>
                    <Switch 
                      checked={rule.is_enabled}
                      onCheckedChange={async (checked) => {
                        await supabase.from('crm_assignment_rules').update({ is_enabled: checked }).eq('id', rule.id);
                        setRules(rules.map(r => r.id === rule.id ? { ...r, is_enabled: checked } : r));
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
                        <DropdownMenuItem onClick={() => openEditDialog(rule)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onClick={() => setDeleteId(rule.id)}>
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
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Edit' : 'Create'} Assignment Rule</DialogTitle>
            <DialogDescription>
              Configure how records are automatically assigned to users.
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
                <Label>Rule Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Lead Round Robin"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Assignment Strategy</Label>
              <Select value={form.strategy} onValueChange={(v) => setForm({ ...form, strategy: v as AssignmentStrategy })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="round_robin">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Round Robin
                    </div>
                  </SelectItem>
                  <SelectItem value="least_loaded">
                    <div className="flex items-center gap-2">
                      <Scale className="w-4 h-4" />
                      Least Loaded
                    </div>
                  </SelectItem>
                  <SelectItem value="fixed">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Fixed Owner
                    </div>
                  </SelectItem>
                  <SelectItem value="territory">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Territory (Advanced)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* User Selection */}
            {(form.strategy === 'round_robin' || form.strategy === 'least_loaded') && (
              <div className="space-y-2">
                <Label>Select Users</Label>
                <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                  {users.map((user) => (
                    <label key={user.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.selectedUsers.includes(user.id)}
                        onChange={() => toggleUser(user.id)}
                        className="rounded"
                      />
                      <span className="text-sm">
                        {user.display_name || user.email}
                      </span>
                    </label>
                  ))}
                  {users.length === 0 && (
                    <p className="text-sm text-slate-500">No users found</p>
                  )}
                </div>
                {form.selectedUsers.length > 0 && (
                  <p className="text-xs text-slate-500">{form.selectedUsers.length} user(s) selected</p>
                )}
              </div>
            )}

            {/* Fixed User Selection */}
            {form.strategy === 'fixed' && (
              <div className="space-y-2">
                <Label>Assign To</Label>
                <Select value={form.fixedUserId} onValueChange={(v) => setForm({ ...form, fixedUserId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.display_name || user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Input
                  type="number"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 100 })}
                  min={1}
                  max={1000}
                />
                <p className="text-xs text-slate-500">Lower numbers = higher priority</p>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Switch
                    checked={form.is_enabled}
                    onCheckedChange={(checked) => setForm({ ...form, is_enabled: checked })}
                  />
                  <span className="text-sm">{form.is_enabled ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleSave} 
              disabled={saving || !form.name || !form.module_id}
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {editingRule ? 'Save Changes' : 'Create Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Assignment Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this assignment rule? This action cannot be undone.
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
