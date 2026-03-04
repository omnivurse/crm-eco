'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ScrollText,
  Loader2,
  RefreshCw,
  Filter,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Search,
  Shield,
  Eye,
  Pencil,
  Trash2,
  Plus,
  LogIn,
  Settings,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@crm-eco/ui/components/card';
import { Button } from '@crm-eco/ui/components/button';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuditLog {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  description: string | null;
  entity_type: string | null;
  entity_id: string | null;
  risk_level: string | null;
  app_source: string | null;
  ip_address: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const PAGE_SIZE = 25;

const ACTION_ICONS: Record<string, React.ReactNode> = {
  create: <Plus className="w-3.5 h-3.5" />,
  update: <Pencil className="w-3.5 h-3.5" />,
  delete: <Trash2 className="w-3.5 h-3.5" />,
  login: <LogIn className="w-3.5 h-3.5" />,
  view: <Eye className="w-3.5 h-3.5" />,
  export: <Settings className="w-3.5 h-3.5" />,
};

const RISK_CONFIG: Record<string, { bg: string; text: string }> = {
  low: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400' },
  medium: { bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-400' },
  high: { bg: 'bg-orange-100 dark:bg-orange-500/20', text: 'text-orange-700 dark:text-orange-400' },
  critical: { bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-400' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AuditLogsTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Filters
  const [actionFilter, setActionFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });
      if (actionFilter) params.set('action', actionFilter);
      if (searchQuery) params.set('q', searchQuery);

      const res = await fetch(`/api/crm/audit-logs?${params}`);
      if (res.ok) {
        const data = await res.json();
        const fetchedLogs: AuditLog[] = data.logs || [];
        setLogs(fetchedLogs);
        setHasMore(fetchedLogs.length >= PAGE_SIZE);
      } else {
        toast.error('Failed to load audit logs');
      }
    } catch {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, searchQuery]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Collect unique entity_types & actions for filters
  const entityTypes = [...new Set(logs.map((l) => l.entity_type).filter(Boolean))] as string[];
  const actions = [...new Set(logs.map((l) => l.action).filter(Boolean))] as string[];

  // Client-side entity_type filter (API might not support it directly)
  const filteredLogs = entityTypeFilter
    ? logs.filter((l) => l.entity_type === entityTypeFilter)
    : logs;

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  function handleSearch() {
    setPage(0);
    setSearchQuery(searchInput);
  }

  function getActionIcon(action: string) {
    const lower = action.toLowerCase();
    for (const [key, icon] of Object.entries(ACTION_ICONS)) {
      if (lower.includes(key)) return icon;
    }
    return <Shield className="w-3.5 h-3.5" />;
  }

  // ---------------------------------------------------------------------------
  // Loading (initial)
  // ---------------------------------------------------------------------------

  if (loading && logs.length === 0 && page === 0) {
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
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Audit Logs</h2>
          <p className="text-slate-600 dark:text-slate-400">
            Track all actions and changes across the system
          </p>
        </div>
        <Button onClick={fetchLogs} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search logs..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 outline-none"
          />
        </div>

        {/* Action Filter */}
        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(0);
          }}
          className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 outline-none"
        >
          <option value="">All Actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        {/* Entity Type Filter */}
        <select
          value={entityTypeFilter}
          onChange={(e) => setEntityTypeFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 outline-none"
        >
          <option value="">All Entity Types</option>
          {entityTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <Button variant="outline" size="sm" onClick={handleSearch}>
          <Filter className="w-4 h-4 mr-1.5" /> Apply
        </Button>
      </div>

      {/* Logs Table */}
      <Card className="glass-card border-slate-200 dark:border-white/10">
        <CardContent className="pt-6">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <ScrollText className="w-14 h-14 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No audit logs found</p>
              <p className="text-sm mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLogs.map((log) => {
                const riskCfg = RISK_CONFIG[log.risk_level || 'low'] || RISK_CONFIG.low;
                return (
                  <div
                    key={log.id}
                    className="p-3 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      {/* Action Icon */}
                      <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0 mt-0.5">
                        {getActionIcon(log.action)}
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-slate-900 dark:text-white">
                            {log.action}
                          </span>
                          {log.entity_type && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              {log.entity_type}
                            </span>
                          )}
                          {log.risk_level && log.risk_level !== 'low' && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${riskCfg.bg} ${riskCfg.text}`}>
                              {log.risk_level}
                            </span>
                          )}
                        </div>

                        {log.description && (
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-2">
                            {log.description}
                          </p>
                        )}

                        <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                          {log.actor_email && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" /> {log.actor_email}
                            </span>
                          )}
                          {log.entity_id && (
                            <span className="truncate max-w-[120px]" title={log.entity_id}>
                              ID: {log.entity_id.slice(0, 8)}...
                            </span>
                          )}
                          {log.app_source && (
                            <span>{log.app_source}</span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {formatDate(log.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {(page > 0 || hasMore) && (
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-200 dark:border-white/10">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Previous
              </Button>
              <span className="text-sm text-slate-500">
                Page {page + 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasMore}
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
