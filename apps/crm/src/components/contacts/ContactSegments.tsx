'use client';

import { useState, useEffect } from 'react';
import {
  Layers,
  Plus,
  Loader2,
  RefreshCw,
  Zap,
  Database,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@crm-eco/ui/components/card';
import { Button } from '@crm-eco/ui/components/button';
import { toast } from 'sonner';

interface Segment {
  id: string;
  name: string;
  key: string;
  description: string | null;
  segment_type: 'dynamic' | 'static' | 'smart';
  module_id: string | null;
  icon: string | null;
  color: string | null;
  is_active: boolean;
  is_system: boolean;
  member_count: number | null;
  compute_interval_hours: number | null;
  last_computed_at: string | null;
  created_at: string;
}

const SEGMENT_TYPE_CONFIG: Record<string, { icon: typeof Zap; label: string; color: string }> = {
  dynamic: { icon: Zap, label: 'Dynamic', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  static: { icon: Database, label: 'Static', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  smart: { icon: Sparkles, label: 'AI / Smart', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
};

export default function ContactSegments() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formName, setFormName] = useState('');
  const [formKey, setFormKey] = useState('');
  const [formType, setFormType] = useState<string>('dynamic');
  const [formDescription, setFormDescription] = useState('');

  async function fetchSegments() {
    try {
      const res = await fetch('/api/crm/segmentations');
      if (res.ok) {
        const json = await res.json();
        setSegments(json.segments || []);
      } else if (res.status !== 503) {
        // Suppress 503 errors (table may not exist yet)
        console.warn('[Segments] Failed to load:', res.status);
      }
    } catch {
      // Silent fail — segments are optional
      console.warn('[Segments] Failed to load segments');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSegments();
  }, []);

  async function handleRecompute(segmentId: string) {
    setRecomputing(segmentId);
    try {
      const res = await fetch('/api/crm/segmentations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: segmentId }),
      });
      if (res.ok) {
        const json = await res.json();
        toast.success(`Membership recomputed: ${json.member_count ?? 0} members`);
        setLoading(true);
        fetchSegments();
      } else {
        const json = await res.json();
        toast.error(json.error || 'Failed to recompute');
      }
    } catch {
      toast.error('Failed to recompute membership');
    } finally {
      setRecomputing(null);
    }
  }

  async function handleCreate() {
    if (!formName.trim() || !formKey.trim()) {
      toast.error('Name and key are required');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/crm/segmentations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          key: formKey.trim(),
          segment_type: formType,
          description: formDescription.trim() || undefined,
        }),
      });
      if (res.ok) {
        toast.success('Segment created');
        setFormName('');
        setFormKey('');
        setFormType('dynamic');
        setFormDescription('');
        setShowForm(false);
        setLoading(true);
        fetchSegments();
      } else {
        const json = await res.json();
        toast.error(json.error || 'Failed to create segment');
      }
    } catch {
      toast.error('Failed to create segment');
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
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Segments</h2>
          <p className="text-slate-600 dark:text-slate-400">
            Dynamic, static, and AI-powered contact segmentation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => { setLoading(true); fetchSegments(); }}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
          <Button onClick={() => setShowForm(!showForm)} size="sm">
            <Plus className="w-4 h-4 mr-2" /> New Segment
          </Button>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white">Create New Segment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="e.g., High-Value Clients"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Key
                </label>
                <input
                  type="text"
                  value={formKey}
                  onChange={(e) => setFormKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="e.g., high_value_clients"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Type
                </label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="dynamic">Dynamic</option>
                  <option value="static">Static</option>
                  <option value="smart">AI / Smart</option>
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
                Create Segment
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Segments List */}
      {segments.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <Layers className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>No segments defined yet</p>
          <Button onClick={() => setShowForm(true)} variant="outline" className="mt-4">
            Create Your First Segment
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {segments.map((segment) => {
            const typeConfig = SEGMENT_TYPE_CONFIG[segment.segment_type] || SEGMENT_TYPE_CONFIG.dynamic;
            const TypeIcon = typeConfig.icon;
            return (
              <Card
                key={segment.id}
                className="glass-card border-slate-200 dark:border-white/10 hover:border-teal-300 dark:hover:border-teal-500/30 transition-colors"
              >
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={`p-2.5 rounded-xl shrink-0 ${typeConfig.color}`}>
                        <TypeIcon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                            {segment.name}
                          </h3>
                          {segment.is_system && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 shrink-0">
                              System
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${typeConfig.color}`}>
                            {typeConfig.label}
                          </span>
                          {segment.description && (
                            <span className="truncate">{segment.description}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 ml-4">
                      {/* Active/Inactive badge */}
                      <div className="flex items-center gap-1 text-sm">
                        {segment.is_active ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-slate-400" />
                        )}
                        <span className={segment.is_active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}>
                          {segment.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>

                      {/* Member count */}
                      <div className="text-right">
                        <p className="text-lg font-bold text-slate-900 dark:text-white">
                          {(segment.member_count ?? 0).toLocaleString()}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">members</p>
                      </div>

                      {/* Recompute button */}
                      {segment.segment_type === 'dynamic' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRecompute(segment.id)}
                          disabled={recomputing === segment.id}
                          className="shrink-0"
                        >
                          {recomputing === segment.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RotateCcw className="w-4 h-4" />
                          )}
                          <span className="ml-1.5 hidden sm:inline">Recompute</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
