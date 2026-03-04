'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Loader2,
  RefreshCw,
  Plus,
  Zap,
  Target,
  ToggleLeft,
  ToggleRight,
  Users,
  ArrowLeft,
  Search,
  RotateCcw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@crm-eco/ui/components/card';
import { Button } from '@crm-eco/ui/components/button';
import { Badge } from '@crm-eco/ui/components/badge';
import { Input } from '@crm-eco/ui/components/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@crm-eco/ui/components/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { toast } from 'sonner';
import Link from 'next/link';

/* ---------- types ---------- */

interface Signal {
  id: string;
  name: string;
  key: string;
  description: string | null;
  category: string;
  severity: string;
  trigger_type: string;
  is_enabled: boolean;
  is_system: boolean;
  created_at: string;
}

interface Segment {
  id: string;
  name: string;
  key: string;
  description: string | null;
  segment_type: string;
  module_id: string | null;
  member_count: number;
  is_active: boolean;
  is_system: boolean;
  icon: string | null;
  color: string | null;
  compute_interval_hours: number;
  last_computed_at: string | null;
  created_at: string;
}

/* ---------- constants ---------- */

const SIGNAL_CATEGORIES = [
  'engagement', 'risk', 'opportunity', 'compliance',
  'lifecycle', 'health', 'activity', 'custom',
] as const;

const SIGNAL_SEVERITIES = ['info', 'low', 'medium', 'high', 'critical'] as const;

const SIGNAL_TRIGGER_TYPES = [
  'condition', 'threshold', 'inactivity', 'scheduled', 'manual',
] as const;

const SEGMENT_TYPES = ['dynamic', 'static', 'smart'] as const;

const SEVERITY_COLORS: Record<string, string> = {
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  low: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const CATEGORY_COLORS: Record<string, string> = {
  engagement: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  risk: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  opportunity: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  compliance: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  lifecycle: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  health: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  activity: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  custom: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
};

/* ---------- component ---------- */

export default function ExperienceCenterPage() {
  const [activeTab, setActiveTab] = useState<'signals' | 'segments'>('signals');

  // Signals state
  const [signals, setSignals] = useState<Signal[]>([]);
  const [signalsLoading, setSignalsLoading] = useState(true);
  const [signalSearch, setSignalSearch] = useState('');
  const [signalCategoryFilter, setSignalCategoryFilter] = useState<string>('all');
  const [showCreateSignal, setShowCreateSignal] = useState(false);
  const [creatingSignal, setCreatingSignal] = useState(false);
  const [newSignal, setNewSignal] = useState({
    name: '',
    key: '',
    description: '',
    category: 'custom' as string,
    severity: 'medium' as string,
    trigger_type: 'condition' as string,
  });

  // Segments state
  const [segments, setSegments] = useState<Segment[]>([]);
  const [segmentsLoading, setSegmentsLoading] = useState(true);
  const [segmentSearch, setSegmentSearch] = useState('');
  const [showCreateSegment, setShowCreateSegment] = useState(false);
  const [creatingSegment, setCreatingSegment] = useState(false);
  const [recomputingId, setRecomputingId] = useState<string | null>(null);
  const [newSegment, setNewSegment] = useState({
    name: '',
    key: '',
    description: '',
    segment_type: 'dynamic' as string,
  });

  /* ---------- fetch signals ---------- */

  const fetchSignals = useCallback(async () => {
    try {
      setSignalsLoading(true);
      const res = await fetch('/api/crm/signals');
      if (!res.ok) throw new Error();
      const json = await res.json();
      setSignals(json.signals || []);
    } catch {
      toast.error('Failed to load signals');
    } finally {
      setSignalsLoading(false);
    }
  }, []);

  /* ---------- fetch segments ---------- */

  const fetchSegments = useCallback(async () => {
    try {
      setSegmentsLoading(true);
      const res = await fetch('/api/crm/segmentations');
      if (!res.ok) throw new Error();
      const json = await res.json();
      setSegments(json.segments || []);
    } catch {
      toast.error('Failed to load segments');
    } finally {
      setSegmentsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSignals();
    fetchSegments();
  }, [fetchSignals, fetchSegments]);

  /* ---------- toggle signal ---------- */

  async function toggleSignal(signal: Signal) {
    try {
      const res = await fetch('/api/crm/signals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: signal.id, is_enabled: !signal.is_enabled }),
      });
      if (!res.ok) throw new Error();
      setSignals((prev) =>
        prev.map((s) => (s.id === signal.id ? { ...s, is_enabled: !s.is_enabled } : s))
      );
      toast.success(`Signal ${signal.is_enabled ? 'disabled' : 'enabled'}`);
    } catch {
      toast.error('Failed to update signal');
    }
  }

  /* ---------- create signal ---------- */

  async function handleCreateSignal() {
    if (!newSignal.name.trim() || !newSignal.key.trim()) {
      toast.error('Name and key are required');
      return;
    }
    try {
      setCreatingSignal(true);
      const res = await fetch('/api/crm/signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSignal),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(typeof err.error === 'string' ? err.error : 'Failed to create signal');
        return;
      }
      toast.success('Signal created');
      setShowCreateSignal(false);
      setNewSignal({ name: '', key: '', description: '', category: 'custom', severity: 'medium', trigger_type: 'condition' });
      fetchSignals();
    } catch {
      toast.error('Failed to create signal');
    } finally {
      setCreatingSignal(false);
    }
  }

  /* ---------- toggle segment ---------- */

  async function toggleSegment(segment: Segment) {
    try {
      const res = await fetch('/api/crm/segmentations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: segment.id, is_active: !segment.is_active }),
      });
      if (!res.ok) throw new Error();
      setSegments((prev) =>
        prev.map((s) => (s.id === segment.id ? { ...s, is_active: !s.is_active } : s))
      );
      toast.success(`Segment ${segment.is_active ? 'deactivated' : 'activated'}`);
    } catch {
      toast.error('Failed to update segment');
    }
  }

  /* ---------- recompute segment ---------- */

  async function recomputeSegment(segment: Segment) {
    try {
      setRecomputingId(segment.id);
      const res = await fetch('/api/crm/segmentations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: segment.id }),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setSegments((prev) =>
        prev.map((s) =>
          s.id === segment.id
            ? { ...s, member_count: json.member_count ?? s.member_count, last_computed_at: new Date().toISOString() }
            : s
        )
      );
      toast.success(`Membership recomputed: ${json.member_count ?? 0} members`);
    } catch {
      toast.error('Failed to recompute membership');
    } finally {
      setRecomputingId(null);
    }
  }

  /* ---------- create segment ---------- */

  async function handleCreateSegment() {
    if (!newSegment.name.trim() || !newSegment.key.trim()) {
      toast.error('Name and key are required');
      return;
    }
    try {
      setCreatingSegment(true);
      const res = await fetch('/api/crm/segmentations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSegment),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(typeof err.error === 'string' ? err.error : 'Failed to create segment');
        return;
      }
      toast.success('Segment created');
      setShowCreateSegment(false);
      setNewSegment({ name: '', key: '', description: '', segment_type: 'dynamic' });
      fetchSegments();
    } catch {
      toast.error('Failed to create segment');
    } finally {
      setCreatingSegment(false);
    }
  }

  /* ---------- filtered lists ---------- */

  const filteredSignals = signals.filter((s) => {
    if (signalSearch && !s.name.toLowerCase().includes(signalSearch.toLowerCase()) && !s.key.toLowerCase().includes(signalSearch.toLowerCase())) return false;
    if (signalCategoryFilter !== 'all' && s.category !== signalCategoryFilter) return false;
    return true;
  });

  const filteredSegments = segments.filter((s) => {
    if (segmentSearch && !s.name.toLowerCase().includes(segmentSearch.toLowerCase()) && !s.key.toLowerCase().includes(segmentSearch.toLowerCase())) return false;
    return true;
  });

  /* ---------- render ---------- */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/crm/settings" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </Link>
          <div className="p-3 bg-amber-500/10 rounded-lg">
            <Sparkles className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Experience Center</h1>
            <p className="text-slate-600 dark:text-slate-400">Behavioral signals, dynamic segmentation, and analytics triggers</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('signals')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'signals'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Zap className="w-4 h-4" /> Signals
        </button>
        <button
          onClick={() => setActiveTab('segments')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'segments'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Target className="w-4 h-4" /> Segments
        </button>
      </div>

      {/* ========== SIGNALS TAB ========== */}
      {activeTab === 'signals' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full sm:w-auto">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search signals..."
                  value={signalSearch}
                  onChange={(e) => setSignalSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={signalCategoryFilter} onValueChange={setSignalCategoryFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {SIGNAL_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => { setSignalsLoading(true); fetchSignals(); }} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" /> Refresh
              </Button>
              <Button onClick={() => setShowCreateSignal(true)} size="sm">
                <Plus className="w-4 h-4 mr-2" /> New Signal
              </Button>
            </div>
          </div>

          {/* Signals List */}
          {signalsLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
            </div>
          ) : filteredSignals.length === 0 ? (
            <div className="text-center py-20 text-slate-500">
              <Zap className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No signals found</p>
              <Button onClick={() => { setSignalsLoading(true); fetchSignals(); }} variant="outline" className="mt-4">Try Again</Button>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredSignals.map((signal) => (
                <Card key={signal.id} className="glass-card border-slate-200 dark:border-white/10">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-slate-900 dark:text-white">{signal.name}</h3>
                          {signal.is_system && (
                            <Badge variant="outline" className="text-xs">System</Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 font-mono">{signal.key}</p>
                        {signal.description && (
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{signal.description}</p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[signal.category] || CATEGORY_COLORS.custom}`}>
                            {signal.category}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_COLORS[signal.severity] || SEVERITY_COLORS.info}`}>
                            {signal.severity}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            {signal.trigger_type}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => toggleSignal(signal)}
                          className="flex items-center gap-1.5 text-sm transition-colors"
                          title={signal.is_enabled ? 'Disable signal' : 'Enable signal'}
                        >
                          {signal.is_enabled ? (
                            <ToggleRight className="w-8 h-8 text-teal-500" />
                          ) : (
                            <ToggleLeft className="w-8 h-8 text-slate-400" />
                          )}
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========== SEGMENTS TAB ========== */}
      {activeTab === 'segments' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="relative flex-1 sm:max-w-xs w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search segments..."
                value={segmentSearch}
                onChange={(e) => setSegmentSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => { setSegmentsLoading(true); fetchSegments(); }} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" /> Refresh
              </Button>
              <Button onClick={() => setShowCreateSegment(true)} size="sm">
                <Plus className="w-4 h-4 mr-2" /> New Segment
              </Button>
            </div>
          </div>

          {/* Segments List */}
          {segmentsLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
            </div>
          ) : filteredSegments.length === 0 ? (
            <div className="text-center py-20 text-slate-500">
              <Target className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No segments found</p>
              <Button onClick={() => { setSegmentsLoading(true); fetchSegments(); }} variant="outline" className="mt-4">Try Again</Button>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredSegments.map((segment) => (
                <Card key={segment.id} className="glass-card border-slate-200 dark:border-white/10">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-slate-900 dark:text-white">{segment.name}</h3>
                          {segment.is_system && (
                            <Badge variant="outline" className="text-xs">System</Badge>
                          )}
                          <Badge
                            variant="secondary"
                            className={`text-xs ${
                              segment.segment_type === 'dynamic'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                : segment.segment_type === 'smart'
                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {segment.segment_type}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 font-mono">{segment.key}</p>
                        {segment.description && (
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{segment.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-3 mt-2">
                          <span className="inline-flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400">
                            <Users className="w-3.5 h-3.5" />
                            {(segment.member_count ?? 0).toLocaleString()} members
                          </span>
                          {segment.last_computed_at && (
                            <span className="text-xs text-slate-500">
                              Computed {new Date(segment.last_computed_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => recomputeSegment(segment)}
                          disabled={recomputingId === segment.id}
                        >
                          {recomputingId === segment.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RotateCcw className="w-4 h-4" />
                          )}
                          <span className="ml-1.5 hidden sm:inline">Recompute</span>
                        </Button>
                        <button
                          onClick={() => toggleSegment(segment)}
                          className="flex items-center gap-1.5 text-sm transition-colors"
                          title={segment.is_active ? 'Deactivate segment' : 'Activate segment'}
                        >
                          {segment.is_active ? (
                            <ToggleRight className="w-8 h-8 text-teal-500" />
                          ) : (
                            <ToggleLeft className="w-8 h-8 text-slate-400" />
                          )}
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========== CREATE SIGNAL DIALOG ========== */}
      <Dialog open={showCreateSignal} onOpenChange={setShowCreateSignal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Signal</DialogTitle>
            <DialogDescription>Define a new behavioral signal for your CRM.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Name</label>
              <Input
                placeholder="e.g. High Churn Risk"
                value={newSignal.name}
                onChange={(e) => setNewSignal((p) => ({ ...p, name: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Key</label>
              <Input
                placeholder="e.g. high_churn_risk"
                value={newSignal.key}
                onChange={(e) => setNewSignal((p) => ({ ...p, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                className="mt-1 font-mono"
              />
              <p className="text-xs text-slate-500 mt-1">Lowercase letters, numbers, and underscores only</p>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
              <Input
                placeholder="Optional description"
                value={newSignal.description}
                onChange={(e) => setNewSignal((p) => ({ ...p, description: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Category</label>
                <Select value={newSignal.category} onValueChange={(v) => setNewSignal((p) => ({ ...p, category: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SIGNAL_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Severity</label>
                <Select value={newSignal.severity} onValueChange={(v) => setNewSignal((p) => ({ ...p, severity: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SIGNAL_SEVERITIES.map((s) => (
                      <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Trigger Type</label>
                <Select value={newSignal.trigger_type} onValueChange={(v) => setNewSignal((p) => ({ ...p, trigger_type: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SIGNAL_TRIGGER_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateSignal(false)}>Cancel</Button>
            <Button onClick={handleCreateSignal} disabled={creatingSignal}>
              {creatingSignal && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Signal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== CREATE SEGMENT DIALOG ========== */}
      <Dialog open={showCreateSegment} onOpenChange={setShowCreateSegment}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Segment</DialogTitle>
            <DialogDescription>Define a new audience segment for targeting and analysis.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Name</label>
              <Input
                placeholder="e.g. High-Value Customers"
                value={newSegment.name}
                onChange={(e) => setNewSegment((p) => ({ ...p, name: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Key</label>
              <Input
                placeholder="e.g. high_value_customers"
                value={newSegment.key}
                onChange={(e) => setNewSegment((p) => ({ ...p, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                className="mt-1 font-mono"
              />
              <p className="text-xs text-slate-500 mt-1">Lowercase letters, numbers, and underscores only</p>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
              <Input
                placeholder="Optional description"
                value={newSegment.description}
                onChange={(e) => setNewSegment((p) => ({ ...p, description: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Segment Type</label>
              <Select value={newSegment.segment_type} onValueChange={(v) => setNewSegment((p) => ({ ...p, segment_type: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEGMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateSegment(false)}>Cancel</Button>
            <Button onClick={handleCreateSegment} disabled={creatingSegment}>
              {creatingSegment && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Segment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
