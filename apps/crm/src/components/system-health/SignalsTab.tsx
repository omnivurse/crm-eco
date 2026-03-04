'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Zap,
  Loader2,
  RefreshCw,
  Bell,
  BellOff,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Activity,
  Clock,
  Shield,
  Target,
  Eye,
  TrendingUp,
  Filter,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@crm-eco/ui/components/card';
import { Button } from '@crm-eco/ui/components/button';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Signal {
  id: string;
  name: string;
  key: string;
  description: string | null;
  category: string;
  severity: string;
  icon: string | null;
  color: string | null;
  trigger_type: string;
  is_enabled: boolean;
  is_system: boolean;
  created_at: string;
}

interface SignalEvent {
  id: string;
  signal_id: string;
  record_id: string;
  status: string;
  message: string | null;
  fired_at: string;
  resolved_at: string | null;
  signal: {
    name: string;
    key: string;
    category: string;
    icon: string | null;
    color: string | null;
  };
}

const SEVERITY_CONFIG: Record<string, { bg: string; text: string }> = {
  info: { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-400' },
  low: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400' },
  medium: { bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-400' },
  high: { bg: 'bg-orange-100 dark:bg-orange-500/20', text: 'text-orange-700 dark:text-orange-400' },
  critical: { bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-400' },
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  engagement: <TrendingUp className="w-4 h-4" />,
  risk: <AlertTriangle className="w-4 h-4" />,
  opportunity: <Target className="w-4 h-4" />,
  compliance: <Shield className="w-4 h-4" />,
  lifecycle: <Activity className="w-4 h-4" />,
  health: <Zap className="w-4 h-4" />,
  activity: <Bell className="w-4 h-4" />,
  custom: <Eye className="w-4 h-4" />,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SignalsTab() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [events, setEvents] = useState<SignalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [resolvingEvent, setResolvingEvent] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const fetchSignals = useCallback(async () => {
    try {
      const res = await fetch('/api/crm/signals?limit=100');
      if (res.ok) {
        const data = await res.json();
        setSignals(data.signals || []);
      } else {
        toast.error('Failed to load signals');
      }
    } catch {
      toast.error('Failed to load signals');
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/crm/signals/events?limit=30');
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      } else {
        toast.error('Failed to load signal events');
      }
    } catch {
      toast.error('Failed to load signal events');
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchSignals(), fetchEvents()]);
    setLoading(false);
  }, [fetchSignals, fetchEvents]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ---------------------------------------------------------------------------
  // Toggle Signal Enabled
  // ---------------------------------------------------------------------------

  async function handleToggleEnabled(signal: Signal) {
    setToggling(signal.id);
    try {
      const res = await fetch('/api/crm/signals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: signal.id,
          is_enabled: !signal.is_enabled,
        }),
      });

      if (res.ok) {
        setSignals((prev) =>
          prev.map((s) => (s.id === signal.id ? { ...s, is_enabled: !s.is_enabled } : s))
        );
        toast.success(`Signal ${signal.is_enabled ? 'disabled' : 'enabled'}`);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to update signal');
      }
    } catch {
      toast.error('Failed to update signal');
    } finally {
      setToggling(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Resolve / Dismiss Event
  // ---------------------------------------------------------------------------

  async function handleEventAction(eventId: string, action: 'resolve' | 'dismiss') {
    setResolvingEvent(eventId);
    try {
      const res = await fetch('/api/crm/signals/events', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: eventId, action }),
      });

      if (res.ok) {
        setEvents((prev) =>
          prev.map((e) =>
            e.id === eventId
              ? { ...e, status: action === 'resolve' ? 'resolved' : 'dismissed', resolved_at: new Date().toISOString() }
              : e
          )
        );
        toast.success(`Signal event ${action}d`);
      } else {
        const data = await res.json();
        toast.error(data.error || `Failed to ${action} event`);
      }
    } catch {
      toast.error(`Failed to ${action} event`);
    } finally {
      setResolvingEvent(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function formatDate(dateStr: string | null) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const categories = ['all', ...new Set(signals.map((s) => s.category))];
  const filteredSignals =
    categoryFilter === 'all' ? signals : signals.filter((s) => s.category === categoryFilter);
  const activeEvents = events.filter((e) => e.status === 'active');

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Signals</h2>
          <p className="text-slate-600 dark:text-slate-400">
            Active signals and recent signal events
          </p>
        </div>
        <Button onClick={fetchAll} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardContent className="pt-6">
            <div className="p-3 rounded-xl bg-teal-500/10 w-fit mb-3">
              <Zap className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{signals.length}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Total Signals</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardContent className="pt-6">
            <div className="p-3 rounded-xl bg-emerald-500/10 w-fit mb-3">
              <Bell className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">
              {signals.filter((s) => s.is_enabled).length}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Enabled</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardContent className="pt-6">
            <div className="p-3 rounded-xl bg-amber-500/10 w-fit mb-3">
              <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{activeEvents.length}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Active Events</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardContent className="pt-6">
            <div className="p-3 rounded-xl bg-blue-500/10 w-fit mb-3">
              <Activity className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{events.length}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Recent Events</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Signal Definitions */}
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-slate-900 dark:text-white">Signal Definitions</CardTitle>
                <CardDescription>{filteredSignals.length} signals</CardDescription>
              </div>
            </div>
            {/* Category filter */}
            <div className="flex items-center gap-2 flex-wrap pt-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
                    categoryFilter === cat
                      ? 'bg-teal-500/10 border-teal-500/50 text-teal-700 dark:text-teal-400'
                      : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {filteredSignals.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Zap className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No signals found</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[480px] overflow-y-auto">
                {filteredSignals.map((signal) => {
                  const severityCfg = SEVERITY_CONFIG[signal.severity] || SEVERITY_CONFIG.info;
                  return (
                    <div
                      key={signal.id}
                      className={`p-3 rounded-lg border transition-colors ${
                        signal.is_enabled
                          ? 'border-slate-200 dark:border-white/10'
                          : 'border-slate-200 dark:border-white/5 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                          <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0">
                            {CATEGORY_ICONS[signal.category] || <Zap className="w-4 h-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-slate-900 dark:text-white truncate">
                              {signal.name}
                            </h4>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-xs text-slate-500 capitalize">{signal.category}</span>
                              <span className={`inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded ${severityCfg.bg} ${severityCfg.text}`}>
                                {signal.severity}
                              </span>
                              <span className="text-xs text-slate-400">{signal.trigger_type}</span>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleEnabled(signal)}
                          disabled={toggling === signal.id || signal.is_system}
                          title={signal.is_system ? 'System signals cannot be disabled' : ''}
                          className="shrink-0"
                        >
                          {toggling === signal.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : signal.is_enabled ? (
                            <Bell className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <BellOff className="w-4 h-4 text-slate-400" />
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Signal Events */}
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white">Recent Signal Events</CardTitle>
            <CardDescription>
              {activeEvents.length} active, {events.length} total
            </CardDescription>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No signal events yet</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[480px] overflow-y-auto">
                {events.map((event) => {
                  const isActive = event.status === 'active';
                  return (
                    <div
                      key={event.id}
                      className={`p-3 rounded-lg border transition-colors ${
                        isActive
                          ? 'border-amber-200 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/5'
                          : 'border-slate-200 dark:border-white/10'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                isActive
                                  ? 'bg-amber-500'
                                  : event.status === 'resolved'
                                  ? 'bg-emerald-500'
                                  : 'bg-slate-400'
                              }`}
                            />
                            <h4 className="text-sm font-medium text-slate-900 dark:text-white truncate">
                              {event.signal?.name || 'Unknown Signal'}
                            </h4>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            Record: {event.record_id.slice(0, 8)}...
                            <span className="ml-2 capitalize">{event.status}</span>
                          </p>
                          {event.message && (
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                              {event.message}
                            </p>
                          )}
                          <p className="text-xs text-slate-400 mt-1">
                            <Clock className="w-3 h-3 inline mr-1" />
                            {formatDate(event.fired_at)}
                            {event.resolved_at && (
                              <span className="ml-2">Resolved: {formatDate(event.resolved_at)}</span>
                            )}
                          </p>
                        </div>
                        {isActive && (
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEventAction(event.id, 'resolve')}
                              disabled={resolvingEvent === event.id}
                              title="Resolve"
                            >
                              {resolvingEvent === event.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEventAction(event.id, 'dismiss')}
                              disabled={resolvingEvent === event.id}
                              title="Dismiss"
                            >
                              <XCircle className="w-3.5 h-3.5 text-slate-400" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
