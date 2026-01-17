'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BookOpen,
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  Save,
  ListChecks,
  HelpCircle,
  Link as LinkIcon,
  Flag,
  Loader2,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { toast } from 'sonner';

interface PlaybookItem {
  type: 'task' | 'question' | 'resource' | 'milestone';
  title: string;
  description?: string;
}

interface PlaybookSection {
  section: string;
  items: PlaybookItem[];
}

interface Playbook {
  id: string;
  name: string;
  description: string | null;
  content: PlaybookSection[];
  target_modules: string[];
  is_active: boolean;
}

const ITEM_TYPES = [
  { value: 'task', label: 'Task', icon: ListChecks },
  { value: 'question', label: 'Question', icon: HelpCircle },
  { value: 'resource', label: 'Resource', icon: LinkIcon },
  { value: 'milestone', label: 'Milestone', icon: Flag },
];

export default function EditPlaybookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetModules, setTargetModules] = useState<string[]>(['Deals']);
  const [isActive, setIsActive] = useState(true);
  const [sections, setSections] = useState<PlaybookSection[]>([]);

  useEffect(() => {
    fetchPlaybook();
  }, [id]);

  async function fetchPlaybook() {
    try {
      const res = await fetch(`/api/playbooks/${id}`);
      if (!res.ok) {
        throw new Error('Playbook not found');
      }
      const playbook: Playbook = await res.json();
      setName(playbook.name);
      setDescription(playbook.description || '');
      setTargetModules(playbook.target_modules || ['Deals']);
      setIsActive(playbook.is_active);
      setSections(playbook.content || [{ section: 'Getting Started', items: [] }]);
    } catch (error) {
      console.error('Failed to fetch playbook:', error);
      toast.error('Failed to load playbook');
      router.push('/crm/playbooks');
    } finally {
      setLoading(false);
    }
  }

  const addSection = () => {
    setSections([...sections, { section: 'New Section', items: [] }]);
  };

  const updateSectionName = (index: number, name: string) => {
    const updated = [...sections];
    updated[index].section = name;
    setSections(updated);
  };

  const removeSection = (index: number) => {
    setSections(sections.filter((_, i) => i !== index));
  };

  const addItem = (sectionIndex: number) => {
    const updated = [...sections];
    updated[sectionIndex].items.push({ type: 'task', title: '' });
    setSections(updated);
  };

  const updateItem = (sectionIndex: number, itemIndex: number, updates: Partial<PlaybookItem>) => {
    const updated = [...sections];
    updated[sectionIndex].items[itemIndex] = {
      ...updated[sectionIndex].items[itemIndex],
      ...updates,
    };
    setSections(updated);
  };

  const removeItem = (sectionIndex: number, itemIndex: number) => {
    const updated = [...sections];
    updated[sectionIndex].items = updated[sectionIndex].items.filter((_, i) => i !== itemIndex);
    setSections(updated);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Please enter a playbook name');
      return;
    }

    const cleanedSections = sections
      .map(s => ({
        section: s.section,
        items: s.items.filter(i => i.title.trim()),
      }))
      .filter(s => s.items.length > 0 || s.section.trim());

    setSaving(true);
    try {
      const res = await fetch(`/api/playbooks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || null,
          content: cleanedSections,
          target_modules: targetModules,
          is_active: isActive,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update playbook');
      }

      toast.success('Playbook updated successfully');
      router.push('/crm/playbooks');
    } catch (error) {
      console.error('Failed to update playbook:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update playbook');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this playbook?')) return;

    try {
      const res = await fetch(`/api/playbooks/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error('Failed to delete playbook');
      }
      toast.success('Playbook deleted');
      router.push('/crm/playbooks');
    } catch (error) {
      toast.error('Failed to delete playbook');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/crm/playbooks"
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 rounded-lg">
              <BookOpen className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Edit Playbook</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Update playbook content and settings
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleDelete}
            className="border-red-200 dark:border-red-800 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push('/crm/playbooks')}
            className="border-slate-200 dark:border-slate-700"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Basic Information
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Playbook Name *
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Enterprise Sales Playbook"
                  className="bg-white dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the purpose of this playbook..."
                  rows={3}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Playbook Sections
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={addSection}
                className="border-slate-200 dark:border-slate-700"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Section
              </Button>
            </div>

            {sections.length === 0 ? (
              <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center">
                <BookOpen className="w-12 h-12 mx-auto text-slate-400 mb-3" />
                <p className="text-slate-500 dark:text-slate-400">No sections yet</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addSection}
                  className="mt-3"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add First Section
                </Button>
              </div>
            ) : (
              sections.map((section, sectionIndex) => (
                <div
                  key={sectionIndex}
                  className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-4"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <GripVertical className="w-4 h-4 text-slate-400 cursor-grab" />
                    <Input
                      value={section.section}
                      onChange={(e) => updateSectionName(sectionIndex, e.target.value)}
                      placeholder="Section name"
                      className="flex-1 bg-white dark:bg-slate-900 font-medium"
                    />
                    <button
                      onClick={() => removeSection(sectionIndex)}
                      className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Items */}
                  <div className="space-y-2 ml-7">
                    {section.items.map((item, itemIndex) => (
                      <div key={itemIndex} className="flex items-start gap-2">
                        <select
                          value={item.type}
                          onChange={(e) =>
                            updateItem(sectionIndex, itemIndex, {
                              type: e.target.value as PlaybookItem['type'],
                            })
                          }
                          className="px-2 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-700 dark:text-slate-300"
                        >
                          {ITEM_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                        <Input
                          value={item.title}
                          onChange={(e) =>
                            updateItem(sectionIndex, itemIndex, { title: e.target.value })
                          }
                          placeholder="Item title"
                          className="flex-1 bg-white dark:bg-slate-900 text-sm"
                        />
                        <button
                          onClick={() => removeItem(sectionIndex, itemIndex)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}

                    <button
                      onClick={() => addItem(sectionIndex)}
                      className="flex items-center gap-1 text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300"
                    >
                      <Plus className="w-4 h-4" />
                      Add item
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Settings</h3>

            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-2 mb-4">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-600 text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Active
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Target Modules
                </label>
                <div className="space-y-2">
                  {['Deals', 'Leads', 'Contacts'].map((module) => (
                    <label key={module} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={targetModules.includes(module)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setTargetModules([...targetModules, module]);
                          } else {
                            setTargetModules(targetModules.filter((m) => m !== module));
                          }
                        }}
                        className="rounded border-slate-300 dark:border-slate-600 text-teal-600 focus:ring-teal-500"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">{module}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Item Types</h3>
            <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              {ITEM_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <div key={type.value} className="flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    <span className="font-medium">{type.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
