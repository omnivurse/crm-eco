'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Loader2,
  RefreshCw,
  Tag,
  Hash,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@crm-eco/ui/components/card';
import { Button } from '@crm-eco/ui/components/button';
import { toast } from 'sonner';

interface ContactGroup {
  id: string;
  group_name: string;
  group_type: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  is_active: boolean;
  display_order: number;
  member_count: number;
  organization_id: string;
}

const GROUP_TYPE_COLORS: Record<string, string> = {
  status: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  product: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  source: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  custom: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
};

export default function ContactGroups() {
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<string>('custom');
  const [formDescription, setFormDescription] = useState('');

  async function fetchGroups() {
    try {
      const res = await fetch('/api/crm/contact-groups');
      if (res.ok) {
        const json = await res.json();
        setGroups(json.data || []);
      } else {
        toast.error('Failed to load contact groups');
      }
    } catch {
      toast.error('Failed to load contact groups');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchGroups();
  }, []);

  async function handleCreate() {
    if (!formName.trim()) {
      toast.error('Group name is required');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/crm/contact-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_name: formName.trim(),
          group_type: formType,
          description: formDescription.trim() || undefined,
        }),
      });
      if (res.ok) {
        toast.success('Group created');
        setFormName('');
        setFormType('custom');
        setFormDescription('');
        setShowForm(false);
        setLoading(true);
        fetchGroups();
      } else {
        const json = await res.json();
        toast.error(json.error || 'Failed to create group');
      }
    } catch {
      toast.error('Failed to create group');
    } finally {
      setCreating(false);
    }
  }

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
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Contact Groups</h2>
          <p className="text-slate-600 dark:text-slate-400">
            Organize contacts into groups by status, product, source, or custom criteria
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => { setLoading(true); fetchGroups(); }}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
          <Button onClick={() => setShowForm(!showForm)} size="sm">
            <Plus className="w-4 h-4 mr-2" /> New Group
          </Button>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white">Create New Group</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Group Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="e.g., VIP Clients"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Group Type
                </label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="custom">Custom</option>
                  <option value="status">Status</option>
                  <option value="product">Product</option>
                  <option value="source">Source</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Description
              </label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="Optional description..."
              />
            </div>
            <div className="flex items-center gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleCreate} disabled={creating}>
                {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Group
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Groups List */}
      {groups.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>No contact groups yet</p>
          <Button onClick={() => setShowForm(true)} variant="outline" className="mt-4">
            Create Your First Group
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <Card
              key={group.id}
              className="glass-card border-slate-200 dark:border-white/10 hover:border-teal-300 dark:hover:border-teal-500/30 transition-colors"
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2.5 rounded-xl ${GROUP_TYPE_COLORS[group.group_type] || GROUP_TYPE_COLORS.custom}`}
                    >
                      <Tag className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white">
                        {group.group_name}
                      </h3>
                      <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                        {group.group_type}
                      </span>
                    </div>
                  </div>
                  {!group.is_active && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                      Inactive
                    </span>
                  )}
                </div>

                {group.description && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 line-clamp-2">
                    {group.description}
                  </p>
                )}

                <div className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                  <Hash className="w-4 h-4" />
                  <span className="font-medium text-slate-900 dark:text-white">
                    {(group.member_count ?? 0).toLocaleString()}
                  </span>{' '}
                  members
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
