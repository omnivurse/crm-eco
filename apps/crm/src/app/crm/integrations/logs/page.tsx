'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import Link from 'next/link';
import {
  FileText,
  ChevronLeft,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  RotateCw,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import type { IntegrationLog, LogStatus, LogDirection, LogEventType } from '@/lib/integrations/types';

// ============================================================================
// Types
// ============================================================================

interface LogsResponse {
  logs: IntegrationLog[];
  total: number;
  hasMore: boolean;
  page: number;
  limit: number;
  stats?: {
    total: number;
    success: number;
    error: number;
    warning: number;
    by_provider: Record<string, number>;
    by_event_type: Record<string, number>;
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString();
}

function formatDuration(ms: number | null): string {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function getStatusIcon(status: LogStatus) {
  switch (status) {
    case 'success':
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case 'error':
      return <XCircle className="w-4 h-4 text-red-500" />;
    case 'warning':
      return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    default:
      return <Clock className="w-4 h-4 text-slate-400" />;
  }
}

function getDirectionIcon(direction: LogDirection) {
  switch (direction) {
    case 'inbound':
      return <ArrowDownLeft className="w-3.5 h-3.5 text-blue-500" />;
    case 'outbound':
      return <ArrowUpRight className="w-3.5 h-3.5 text-purple-500" />;
    default:
      return <RotateCw className="w-3.5 h-3.5 text-slate-400" />;
  }
}

function getEventTypeLabel(type: LogEventType): string {
  const labels: Record<LogEventType, string> = {
    api_call: 'API Call',
    webhook_received: 'Webhook',
    sync_started: 'Sync Started',
    sync_completed: 'Sync Complete',
    sync_failed: 'Sync Failed',
    auth_refresh: 'Auth Refresh',
    auth_expired: 'Auth Expired',
    error: 'Error',
    warning: 'Warning',
    info: 'Info',
  };
  return labels[type] || type;
}

// ============================================================================
// Components
// ============================================================================

function StatsBar({ stats }: { stats: LogsResponse['stats'] }) {
  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-lg p-4">
        <div className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</div>
        <div className="text-sm text-slate-500 dark:text-slate-400">Total Events</div>
      </div>
      <div className="glass-card border border-green-200 dark:border-green-800 rounded-lg p-4 bg-green-50 dark:bg-green-900/20">
        <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.success}</div>
        <div className="text-sm text-slate-500 dark:text-slate-400">Success</div>
      </div>
      <div className="glass-card border border-red-200 dark:border-red-800 rounded-lg p-4 bg-red-50 dark:bg-red-900/20">
        <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.error}</div>
        <div className="text-sm text-slate-500 dark:text-slate-400">Errors</div>
      </div>
      <div className="glass-card border border-amber-200 dark:border-amber-800 rounded-lg p-4 bg-amber-50 dark:bg-amber-900/20">
        <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.warning}</div>
        <div className="text-sm text-slate-500 dark:text-slate-400">Warnings</div>
      </div>
    </div>
  );
}

function LogRow({ log, onExpand }: { log: IntegrationLog; onExpand: (id: string) => void }) {
  return (
    <tr 
      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
      onClick={() => onExpand(log.id)}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {getStatusIcon(log.status)}
          <span className="text-sm font-medium text-slate-900 dark:text-white capitalize">
            {log.status}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          {getDirectionIcon(log.direction)}
          <span className="text-sm text-slate-600 dark:text-slate-300">
            {getEventTypeLabel(log.event_type)}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm font-medium text-slate-900 dark:text-white capitalize">
          {log.provider.replace(/_/g, ' ')}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm text-slate-600 dark:text-slate-300 font-mono">
          {log.endpoint || log.method || '-'}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {formatDuration(log.duration_ms)}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {formatDate(log.created_at)}
        </span>
      </td>
      <td className="px-4 py-3">
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </td>
    </tr>
  );
}

function LogDetail({ log, onClose }: { log: IntegrationLog; onClose: () => void }) {
  return (
    <tr className="bg-slate-50 dark:bg-slate-800/50">
      <td colSpan={7} className="px-4 py-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-slate-900 dark:text-white">Log Details</h4>
            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              Close
            </button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-slate-500 dark:text-slate-400">Log ID</div>
              <div className="font-mono text-slate-900 dark:text-white truncate">{log.id}</div>
            </div>
            {log.connection_id && (
              <div>
                <div className="text-slate-500 dark:text-slate-400">Connection ID</div>
                <div className="font-mono text-slate-900 dark:text-white truncate">{log.connection_id}</div>
              </div>
            )}
            {log.response_status && (
              <div>
                <div className="text-slate-500 dark:text-slate-400">HTTP Status</div>
                <div className={`font-medium ${log.response_status >= 400 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                  {log.response_status}
                </div>
              </div>
            )}
            {log.entity_type && (
              <div>
                <div className="text-slate-500 dark:text-slate-400">Entity</div>
                <div className="text-slate-900 dark:text-white">{log.entity_type} / {log.entity_id}</div>
              </div>
            )}
          </div>
          
          {log.error_message && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="text-sm font-medium text-red-800 dark:text-red-300 mb-1">Error Message</div>
              <div className="text-sm text-red-700 dark:text-red-400">{log.error_message}</div>
              {log.error_code && (
                <div className="text-xs text-red-600 dark:text-red-500 mt-1">Code: {log.error_code}</div>
              )}
            </div>
          )}
          
          {log.request_body && Object.keys(log.request_body).length > 0 && (
            <div>
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Request Body</div>
              <pre className="p-3 bg-slate-100 dark:bg-slate-900 rounded-lg text-xs overflow-x-auto text-slate-800 dark:text-slate-200">
                {JSON.stringify(log.request_body, null, 2)}
              </pre>
            </div>
          )}
          
          {log.response_body && Object.keys(log.response_body).length > 0 && (
            <div>
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Response Body</div>
              <pre className="p-3 bg-slate-100 dark:bg-slate-900 rounded-lg text-xs overflow-x-auto text-slate-800 dark:text-slate-200">
                {JSON.stringify(log.response_body, null, 2)}
              </pre>
            </div>
          )}
          
          {log.metadata && Object.keys(log.metadata).length > 0 && (
            <div>
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Metadata</div>
              <pre className="p-3 bg-slate-100 dark:bg-slate-900 rounded-lg text-xs overflow-x-auto text-slate-800 dark:text-slate-200">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function IntegrationLogsPage() {
  const [logs, setLogs] = useState<IntegrationLog[]>([]);
  const [stats, setStats] = useState<LogsResponse['stats']>();
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [providerFilter, setProviderFilter] = useState<string>('');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('');

  // Live search with debounce (300ms for API calls)
  const { query: searchQuery, setQuery: setSearchQuery, debouncedQuery } = useDebouncedSearch({ delay: 300 });

  const fetchLogs = useCallback(async (pageNum: number = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '25',
        include_stats: 'true',
      });
      
      if (statusFilter) params.set('status', statusFilter);
      if (providerFilter) params.set('provider', providerFilter);
      if (eventTypeFilter) params.set('event_type', eventTypeFilter);
      if (debouncedQuery) params.set('search', debouncedQuery);
      
      const response = await fetch(`/api/integrations/logs?${params}`);
      const data: LogsResponse = await response.json();
      
      setLogs(data.logs);
      setTotal(data.total);
      setHasMore(data.hasMore);
      setStats(data.stats);
      setPage(pageNum);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      toast.error('Failed to load integration logs');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, providerFilter, eventTypeFilter, debouncedQuery]);

  useEffect(() => {
    fetchLogs(1);
  }, [fetchLogs]);

  const handleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/crm/integrations"
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-slate-500" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <FileText className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Integration Logs</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {total} total events
              </p>
            </div>
          </div>
        </div>
        
        <button
          onClick={() => fetchLogs(page)}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
      
      {/* Stats */}
      <StatsBar stats={stats} />
      
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400"
          />
        </div>
        
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
        >
          <option value="">All Status</option>
          <option value="success">Success</option>
          <option value="error">Error</option>
          <option value="warning">Warning</option>
          <option value="pending">Pending</option>
        </select>
        
        <select
          value={eventTypeFilter}
          onChange={(e) => setEventTypeFilter(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
        >
          <option value="">All Types</option>
          <option value="api_call">API Call</option>
          <option value="webhook_received">Webhook</option>
          <option value="sync_started">Sync Started</option>
          <option value="sync_completed">Sync Complete</option>
          <option value="sync_failed">Sync Failed</option>
          <option value="auth_refresh">Auth Refresh</option>
          <option value="auth_expired">Auth Expired</option>
          <option value="error">Error</option>
        </select>
        
        <select
          value={providerFilter}
          onChange={(e) => setProviderFilter(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
        >
          <option value="">All Providers</option>
          <option value="sendgrid">SendGrid</option>
          <option value="resend">Resend</option>
          <option value="twilio">Twilio</option>
          <option value="zoom">Zoom</option>
          <option value="google_calendar">Google Calendar</option>
          <option value="microsoft_outlook">Microsoft Outlook</option>
          <option value="slack">Slack</option>
          <option value="stripe">Stripe</option>
          <option value="docusign">DocuSign</option>
        </select>
        
        <button
          onClick={() => {
            setStatusFilter('');
            setProviderFilter('');
            setEventTypeFilter('');
            setSearchQuery('');
          }}
          className="flex items-center gap-2 px-3 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <Filter className="w-4 h-4" />
          Clear
        </button>
      </div>
      
      {/* Logs Table */}
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Event
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Provider
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Endpoint
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {loading && logs.length === 0 ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3"><div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-12 bg-slate-200 dark:bg-slate-700 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-28 bg-slate-200 dark:bg-slate-700 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-4 bg-slate-200 dark:bg-slate-700 rounded" /></td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="text-slate-500 dark:text-slate-400">
                      <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No logs found</p>
                      <p className="text-sm mt-1">Integration activity will appear here</p>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <>
                    <LogRow key={log.id} log={log} onExpand={handleExpand} />
                    {expandedId === log.id && (
                      <LogDetail key={`${log.id}-detail`} log={log} onClose={() => setExpandedId(null)} />
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {(logs.length > 0 || hasMore) && (
          <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Showing {(page - 1) * 25 + 1} - {Math.min(page * 25, total)} of {total}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => fetchLogs(page - 1)}
                disabled={page === 1 || loading}
                className="px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300"
              >
                Previous
              </button>
              <button
                onClick={() => fetchLogs(page + 1)}
                disabled={!hasMore || loading}
                className="px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
