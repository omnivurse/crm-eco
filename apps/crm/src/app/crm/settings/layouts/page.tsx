'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { toast } from 'sonner';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { Switch } from '@crm-eco/ui/components/switch';
import { Badge } from '@crm-eco/ui/components/badge';
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
import {
  ArrowLeft,
  Plus,
  Pencil,
  Copy,
  Trash2,
  Layout as LayoutIcon,
  Check,
  Loader2,
  GripVertical,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { CrmLayout, LayoutSection, CrmModule } from '@/lib/crm/types';

interface LayoutWithModule extends CrmLayout {
  module?: CrmModule;
}

export default function LayoutsPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [layouts, setLayouts] = useState<LayoutWithModule[]>([]);
  const [modules, setModules] = useState<CrmModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState('');
  const [selectedModuleId, setSelectedModuleId] = useState<string>('all');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CrmLayout | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    module_id: '',
    name: '',
    is_default: false,
    sections: [] as LayoutSection[],
  });

  // Section editor state
  const [newSectionLabel, setNewSectionLabel] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id, crm_role')
        .eq('user_id', user.id)
        .single();

      if (!profile || profile.crm_role !== 'crm_admin') {
        router.push('/crm/settings?error=admin_only');
        return;
      }

      setOrgId(profile.organization_id);

      const [modulesRes, layoutsRes] = await Promise.all([
        supabase.from('crm_modules').select('*').eq('org_id', profile.organization_id).eq('is_enabled', true).order('display_order'),
        supabase.from('crm_layouts').select('*').eq('org_id', profile.organization_id).order('name'),
      ]);

      setModules((modulesRes.data || []) as CrmModule[]);

      // Merge module info into layouts
      const layoutsWithModules = (layoutsRes.data || []).map((layout: CrmLayout) => ({
        ...layout,
        module: modulesRes.data?.find((m: CrmModule) => m.id === layout.module_id),
      }));
      setLayouts(layoutsWithModules);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load layouts');
    } finally {
      setLoading(false);
    }
  }, [supabase, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredLayouts = selectedModuleId === 'all'
    ? layouts
    : layouts.filter(l => l.module_id === selectedModuleId);

  const openCreateDialog = () => {
    setEditing(null);
    setForm({
      module_id: modules[0]?.id || '',
      name: '',
      is_default: false,
      sections: [
        { key: 'general', label: 'General Information', columns: 2 },
      ],
    });
    setDialogOpen(true);
  };

  const openEditDialog = (layout: CrmLayout) => {
    setEditing(layout);
    setForm({
      module_id: layout.module_id,
      name: layout.name,
      is_default: layout.is_default,
      sections: layout.config?.sections || [],
    });
    setDialogOpen(true);
  };

  const handleDuplicate = async (layout: CrmLayout) => {
    try {
      const { error } = await supabase.from('crm_layouts').insert({
        org_id: orgId,
        module_id: layout.module_id,
        name: `${layout.name} (Copy)`,
        is_default: false,
        config: layout.config,
      });

      if (error) throw error;
      toast.success('Layout duplicated successfully');
      fetchData();
    } catch (error) {
      console.error('Failed to duplicate:', error);
      toast.error('Failed to duplicate layout');
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.module_id) return;
    setSaving(true);

    try {
      const data = {
        org_id: orgId,
        module_id: form.module_id,
        name: form.name,
        is_default: form.is_default,
        config: { sections: form.sections },
      };

      // If setting as default, unset other defaults first
      if (form.is_default) {
        await supabase
          .from('crm_layouts')
          .update({ is_default: false })
          .eq('module_id', form.module_id)
          .eq('org_id', orgId);
      }

      if (editing) {
        const { error } = await supabase
          .from('crm_layouts')
          .update(data)
          .eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('crm_layouts').insert(data);
        if (error) throw error;
      }

      toast.success(editing ? 'Layout updated successfully' : 'Layout created successfully');
      fetchData();
      setDialogOpen(false);
    } catch (error) {
      console.error('Failed to save:', error);
      toast.error('Failed to save layout');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await supabase.from('crm_layouts').delete().eq('id', deleteId);
      toast.success('Layout deleted successfully');
      setLayouts(layouts.filter(l => l.id !== deleteId));
    } catch (error) {
      console.error('Failed to delete:', error);
      toast.error('Failed to delete layout');
    } finally {
      setDeleteId(null);
    }
  };

  // Section management
  const addSection = () => {
    if (!newSectionLabel.trim()) return;
    const key = newSectionLabel.toLowerCase().replace(/\s+/g, '_');
    setForm({
      ...form,
      sections: [
        ...form.sections,
        { key, label: newSectionLabel.trim(), columns: 2 },
      ],
    });
    setNewSectionLabel('');
  };

  const removeSection = (key: string) => {
    setForm({
      ...form,
      sections: form.sections.filter(s => s.key !== key),
    });
  };

  const updateSection = (key: string, updates: Partial<LayoutSection>) => {
    setForm({
      ...form,
      sections: form.sections.map(s =>
        s.key === key ? { ...s, ...updates } : s
      ),
    });
  };

  const moveSection = (index: number, direction: 'up' | 'down') => {
    const newSections = [...form.sections];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newSections.length) return;
    [newSections[index], newSections[newIndex]] = [newSections[newIndex], newSections[index]];
    setForm({ ...form, sections: newSections });
  };

  const getModuleName = (moduleId: string) => modules.find(m => m.id === moduleId)?.name || 'Unknown';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/crm/settings"
            className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Layouts</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Configure form layouts and section arrangements
            </p>
          </div>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          New Layout
        </Button>
      </div>

      {/* Module Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedModuleId('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${selectedModuleId === 'all'
              ? 'bg-teal-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
        >
          All Modules
        </button>
        {modules.map((module) => (
          <button
            key={module.id}
            onClick={() => setSelectedModuleId(module.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${selectedModuleId === module.id
                ? 'bg-teal-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
          >
            {module.name}
          </button>
        ))}
      </div>

      {/* Layouts Grid */}
      {filteredLayouts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLayouts.map((layout) => (
            <div
              key={layout.id}
              className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
            >
              <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-slate-900 dark:text-white font-medium">{layout.name}</h3>
                  {layout.is_default && (
                    <span className="px-2 py-0.5 text-xs bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-full flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Default
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">{layout.module?.name || getModuleName(layout.module_id)}</p>
              </div>

              <div className="p-4">
                <p className="text-xs text-slate-500 mb-2">Sections</p>
                <div className="space-y-1">
                  {(layout.config?.sections || []).slice(0, 4).map((section) => (
                    <div key={section.key} className="flex items-center gap-2 text-sm">
                      <span className="w-2 h-2 rounded-full bg-teal-400/50" />
                      <span className="text-slate-700 dark:text-slate-300">{section.label}</span>
                      <span className="text-slate-400 dark:text-slate-500 text-xs">({section.columns} col)</span>
                    </div>
                  ))}
                  {(layout.config?.sections || []).length > 4 && (
                    <p className="text-xs text-slate-500 mt-1">
                      +{(layout.config?.sections || []).length - 4} more
                    </p>
                  )}
                </div>
              </div>

              <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-2">
                <button
                  onClick={() => openEditDialog(layout)}
                  className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                  title="Edit"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDuplicate(layout)}
                  className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                  title="Duplicate"
                >
                  <Copy className="w-4 h-4" />
                </button>
                {!layout.is_default && (
                  <button
                    onClick={() => setDeleteId(layout.id)}
                    className="p-2 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
          <LayoutIcon className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">
            {selectedModuleId !== 'all'
              ? `No layouts configured for ${getModuleName(selectedModuleId)}`
              : 'No layouts configured'}
          </p>
          <button
            onClick={openCreateDialog}
            className="mt-4 text-teal-600 dark:text-teal-400 hover:text-teal-500 dark:hover:text-teal-300 text-sm"
          >
            Create a layout
          </button>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit' : 'Create'} Layout</DialogTitle>
            <DialogDescription>
              Configure form sections and their arrangement
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Module</Label>
                <Select
                  value={form.module_id}
                  onValueChange={(v) => setForm({ ...form, module_id: v })}
                  disabled={!!editing}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select module" />
                  </SelectTrigger>
                  <SelectContent>
                    {modules.map((mod) => (
                      <SelectItem key={mod.id} value={mod.id}>
                        {mod.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Layout Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Standard Layout"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_default}
                onCheckedChange={(checked) => setForm({ ...form, is_default: checked })}
              />
              <Label>Set as default layout for this module</Label>
            </div>

            {/* Sections Editor */}
            <div className="space-y-2">
              <Label>Sections</Label>
              <div className="border rounded-lg overflow-hidden">
                {form.sections.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    No sections defined. Add your first section below.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200 dark:divide-slate-700">
                    {form.sections.map((section, index) => (
                      <div
                        key={section.key}
                        className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50"
                      >
                        <GripVertical className="w-4 h-4 text-slate-400" />
                        <div className="flex-1">
                          <Input
                            value={section.label}
                            onChange={(e) =>
                              updateSection(section.key, { label: e.target.value })
                            }
                            className="h-8"
                          />
                        </div>
                        <Select
                          value={String(section.columns)}
                          onValueChange={(v) =>
                            updateSection(section.key, { columns: parseInt(v) as 1 | 2 })
                          }
                        >
                          <SelectTrigger className="w-24 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 Column</SelectItem>
                            <SelectItem value="2">2 Columns</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => moveSection(index, 'up')}
                            disabled={index === 0}
                            className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => moveSection(index, 'down')}
                            disabled={index === form.sections.length - 1}
                            className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => removeSection(section.key)}
                            className="p-1 text-slate-400 hover:text-red-500"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Section */}
              <div className="flex gap-2">
                <Input
                  value={newSectionLabel}
                  onChange={(e) => setNewSectionLabel(e.target.value)}
                  placeholder="New section name"
                  onKeyDown={(e) => e.key === 'Enter' && addSection()}
                />
                <Button variant="outline" onClick={addSection} disabled={!newSectionLabel.trim()}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.name || !form.module_id}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {editing ? 'Save Changes' : 'Create Layout'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Layout</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this layout? This action cannot be undone.
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
