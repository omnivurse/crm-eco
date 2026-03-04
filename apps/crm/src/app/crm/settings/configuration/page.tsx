'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@crm-eco/lib/supabase/client';
import {
  Settings,
  Shield,
  MessageSquare,
  Palette,
  Zap,
  GitBranch,
  Database,
  BarChart3,
  Code,
  Save,
  Plus,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Pencil,
  X,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Badge } from '@crm-eco/ui/components/badge';
import { Switch } from '@crm-eco/ui/components/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────
interface SystemSetting {
  id: string;
  organization_id: string;
  category: string;
  setting_key: string;
  setting_value: unknown;
  description: string | null;
  is_sensitive: boolean;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

const CATEGORIES = [
  'general',
  'security',
  'channels',
  'customization',
  'automation',
  'process',
  'data_admin',
  'experience',
  'developer',
] as const;

type Category = (typeof CATEGORIES)[number];

const CATEGORY_META: Record<Category, { label: string; icon: React.ReactNode; color: string }> = {
  general:       { label: 'General',         icon: <Settings className="w-4 h-4" />,        color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
  security:      { label: 'Security',        icon: <Shield className="w-4 h-4" />,          color: 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400' },
  channels:      { label: 'Channels',        icon: <MessageSquare className="w-4 h-4" />,   color: 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400' },
  customization: { label: 'Customization',   icon: <Palette className="w-4 h-4" />,         color: 'bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400' },
  automation:    { label: 'Automation',       icon: <Zap className="w-4 h-4" />,             color: 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400' },
  process:       { label: 'Process',         icon: <GitBranch className="w-4 h-4" />,       color: 'bg-teal-100 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400' },
  data_admin:    { label: 'Data Admin',      icon: <Database className="w-4 h-4" />,        color: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400' },
  experience:    { label: 'Experience',      icon: <BarChart3 className="w-4 h-4" />,       color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' },
  developer:     { label: 'Developer',       icon: <Code className="w-4 h-4" />,            color: 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function renderValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'number') return String(val);
  return JSON.stringify(val, null, 2);
}

function parseInputValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed !== '' && !isNaN(Number(trimmed)) && !trimmed.startsWith('0')) return Number(trimmed);
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === 'object') return parsed;
  } catch {
    // not JSON — keep as string
  }
  return trimmed;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function SystemConfigurationPage() {
  const searchParams = useSearchParams();
  const urlTab = searchParams.get('tab');
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set([urlTab === 'pipelines' ? 'process' : 'general'])
  );

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // New setting dialog
  const [showAdd, setShowAdd] = useState(false);
  const [newCategory, setNewCategory] = useState<Category>('general');
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newSensitive, setNewSensitive] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<SystemSetting | null>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/crm/system-settings');
      if (!res.ok) throw new Error('Failed to fetch');
      const { settings: data } = await res.json();
      setSettings(data || []);
    } catch (err) {
      console.error('[Config] fetch error', err);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  // ── Save inline edit ──────────────────────────────────────────────────────
  async function handleSave(setting: SystemSetting) {
    setSaving(setting.id);
    try {
      const res = await fetch('/api/crm/system-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: setting.category,
          setting_key: setting.setting_key,
          setting_value: parseInputValue(editValue),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Save failed');
      }
      toast.success(`Updated ${setting.setting_key}`);
      setEditingId(null);
      fetchSettings();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(null);
    }
  }

  // ── Create new ────────────────────────────────────────────────────────────
  async function handleCreate() {
    if (!newKey.trim()) { toast.error('Key is required'); return; }
    setSaving('new');
    try {
      const res = await fetch('/api/crm/system-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: newCategory,
          setting_key: newKey.trim(),
          setting_value: parseInputValue(newValue),
          description: newDescription || undefined,
          is_sensitive: newSensitive,
        }),
      });
      if (!res.ok) throw new Error('Create failed');
      toast.success(`Created ${newKey}`);
      setShowAdd(false);
      setNewKey('');
      setNewValue('');
      setNewDescription('');
      setNewSensitive(false);
      fetchSettings();
    } catch {
      toast.error('Failed to create setting');
    } finally {
      setSaving(null);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/crm/system-settings?id=${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      toast.success(`Deleted ${deleteTarget.setting_key}`);
      setDeleteTarget(null);
      fetchSettings();
    } catch {
      toast.error('Failed to delete setting');
    }
  }

  // ── Toggle category ──────────────────────────────────────────────────────
  function toggleCategory(cat: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }

  // ── Group by category ────────────────────────────────────────────────────
  const grouped = CATEGORIES.reduce<Record<string, SystemSetting[]>>((acc, cat) => {
    acc[cat] = settings.filter((s) => s.category === cat);
    return acc;
  }, {} as Record<string, SystemSetting[]>);

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-6 h-6 animate-spin text-teal-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 shadow-lg">
            <Settings className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">System Configuration</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Centralized settings for all CRM modules
            </p>
          </div>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Setting
        </Button>
      </div>

      {/* Categories */}
      {CATEGORIES.map((cat) => {
        const meta = CATEGORY_META[cat];
        const items = grouped[cat] || [];
        const isOpen = expandedCategories.has(cat);

        return (
          <div
            key={cat}
            className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden"
          >
            {/* Category header */}
            <button
              onClick={() => toggleCategory(cat)}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${meta.color}`}>{meta.icon}</div>
                <span className="font-semibold text-slate-900 dark:text-white">{meta.label}</span>
                <Badge variant="secondary" className="text-xs">
                  {items.length}
                </Badge>
              </div>
              {isOpen ? (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              ) : (
                <ChevronRight className="w-5 h-5 text-slate-400" />
              )}
            </button>

            {/* Settings rows */}
            {isOpen && (
              <div className="border-t border-slate-100 dark:border-white/5">
                {items.length === 0 ? (
                  <p className="px-6 py-4 text-sm text-slate-400">No settings configured</p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-white/5">
                    {items.map((s) => {
                      const isEditing = editingId === s.id;
                      return (
                        <div
                          key={s.id}
                          className="flex items-center gap-4 px-6 py-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                        >
                          {/* Key + description */}
                          <div className="min-w-[200px] flex-shrink-0">
                            <code className="text-sm font-medium text-slate-800 dark:text-slate-200">
                              {s.setting_key}
                            </code>
                            {s.description && (
                              <p className="text-xs text-slate-400 mt-0.5">{s.description}</p>
                            )}
                          </div>

                          {/* Value */}
                          <div className="flex-1 min-w-0">
                            {isEditing ? (
                              <Input
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="font-mono text-sm"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSave(s);
                                  if (e.key === 'Escape') setEditingId(null);
                                }}
                              />
                            ) : (
                              <code className="text-sm text-slate-600 dark:text-slate-400 truncate block">
                                {s.is_sensitive
                                  ? '••••••••'
                                  : renderValue(s.setting_value)}
                              </code>
                            )}
                          </div>

                          {/* Badges */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {s.is_sensitive && (
                              <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                                Sensitive
                              </Badge>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {isEditing ? (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleSave(s)}
                                  disabled={saving === s.id}
                                >
                                  <Save className="w-3 h-3 mr-1" />
                                  {saving === s.id ? 'Saving...' : 'Save'}
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                                  <X className="w-3 h-3" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingId(s.id);
                                    setEditValue(renderValue(s.setting_value));
                                  }}
                                >
                                  <Pencil className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-500 hover:text-red-700"
                                  onClick={() => setDeleteTarget(s)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Add Setting Dialog ──────────────────────────────────────────────── */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add System Setting</DialogTitle>
            <DialogDescription>Create a new configuration entry</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Category</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as Category)}
                className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_META[c].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Key</label>
              <Input
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="e.g. session_timeout_minutes"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Value</label>
              <Input
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder='e.g. 30 or {"key":"val"}'
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Description (optional)
              </label>
              <Input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Human-readable description"
                className="mt-1"
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={newSensitive} onCheckedChange={setNewSensitive} />
              <label className="text-sm text-slate-600 dark:text-slate-400">
                Mark as sensitive (value hidden from non-admins)
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving === 'new'}>
              {saving === 'new' ? 'Creating...' : 'Create Setting'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Dialog ───────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Delete Setting
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <code className="font-semibold">{deleteTarget?.setting_key}</code> from{' '}
              <code>{deleteTarget?.category}</code>? This action is logged and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
