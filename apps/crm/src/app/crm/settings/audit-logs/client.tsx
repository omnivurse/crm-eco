'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase-client';
import { toast } from 'sonner';
import { useAuditFeed } from '@crm-eco/shared/audit';
import { AuditLogTable, type AuditLogEntry } from '@crm-eco/ui/components/audit-log-table';
import {
  AuditLogFilters,
  type AuditLogFilterState,
} from '@crm-eco/ui/components/audit-log-filters';
import { ExportButton } from '@crm-eco/ui/components/export-button';
import { Button } from '@crm-eco/ui/components/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@crm-eco/ui/components/sheet';
import {
  Shield,
  ChevronLeft,
  RefreshCw,
  Activity,
  FileJson,
  FileSpreadsheet,
  Clock,
  User,
  MapPin,
  Monitor,
  Hash,
} from 'lucide-react';
import { RiskLevelBadge } from '@crm-eco/ui/components/risk-level-badge';
import { format } from 'date-fns';

interface AuditLogsClientProps {
  initialLogs: AuditLogEntry[];
  users: Array<{ id: string; full_name: string; email: string }>;
  profile: {
    id: string;
    organization_id: string;
    crm_role: string | null;
    full_name: string;
    email: string;
  };
}

export function AuditLogsClient({ initialLogs, users, profile }: AuditLogsClientProps) {
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLogEntry[]>(initialLogs);
  const [filters, setFilters] = useState<AuditLogFilterState>({});
  const [isExporting, setIsExporting] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  // Real-time subscription with toast for high-risk events
  const auditFeed = useAuditFeed(supabase, {
    orgId: profile.organization_id,
    appSource: 'crm',
    throttleMs: 500,
    onHighRiskEvent: (event) => {
      toast.warning(`High-risk activity detected`, {
        description: event.description || event.action,
        duration: 8000,
      });
    },
  });

  // Merge real-time events with initial logs
  const displayLogs = [...auditFeed.events, ...logs].filter((log, index, self) =>
    index === self.findIndex((l) => l.id === log.id)
  );

  // Apply client-side filters
  const filteredLogs = displayLogs.filter((log) => {
    if (filters.userId && log.actor_id !== filters.userId) return false;
    if (filters.actionType && log.action !== filters.actionType) return false;
    if (filters.riskLevel && filters.riskLevel !== 'all' && log.risk_level !== filters.riskLevel)
      return false;
    if (filters.dateFrom && new Date(log.created_at) < new Date(filters.dateFrom)) return false;
    if (filters.dateTo && new Date(log.created_at) > new Date(filters.dateTo)) return false;
    if (
      filters.searchQuery &&
      !log.description?.toLowerCase().includes(filters.searchQuery.toLowerCase()) &&
      !log.action.toLowerCase().includes(filters.searchQuery.toLowerCase()) &&
      !log.actor_email?.toLowerCase().includes(filters.searchQuery.toLowerCase())
    )
      return false;
    return true;
  });

  // Handle filter changes
  const handleFiltersChange = useCallback((newFilters: AuditLogFilterState) => {
    setFilters(newFilters);
  }, []);

  // Export handler
  const handleExport = useCallback(
    async (format: string) => {
      setIsExporting(true);
      try {
        const params = new URLSearchParams({ format });
        if (filters.userId) params.set('userId', filters.userId);
        if (filters.actionType) params.set('action', filters.actionType);
        if (filters.riskLevel && filters.riskLevel !== 'all')
          params.set('riskLevel', filters.riskLevel);
        if (filters.dateFrom) params.set('from', filters.dateFrom);
        if (filters.dateTo) params.set('to', filters.dateTo);

        const response = await fetch(`/api/crm/audit-logs/export?${params}`);
        if (!response.ok) {
          throw new Error('Export failed');
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`;
        a.click();
        URL.revokeObjectURL(url);

        toast.success('Export complete');
      } catch (error) {
        toast.error('Export failed');
      } finally {
        setIsExporting(false);
      }
    },
    [filters]
  );

  // Format users for filter dropdown
  const filterUsers = users.map((u) => ({
    id: u.id,
    name: u.full_name,
    email: u.email,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/crm/settings">
            <Button variant="ghost" size="icon" className="rounded-xl">
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 shadow-lg">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Audit Logs</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Track system activity and security events
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Live indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg border border-emerald-200 dark:border-emerald-500/20">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              Live
            </span>
          </div>

          <Button variant="outline" size="sm" onClick={() => auditFeed.refresh()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>

          <ExportButton
            onExport={handleExport}
            disabled={isExporting}
            options={[
              {
                format: 'csv',
                label: 'CSV',
                description: 'Spreadsheet format',
                icon: <FileSpreadsheet className="w-4 h-4" />,
              },
              {
                format: 'json',
                label: 'JSON',
                description: 'Raw data format',
                icon: <FileJson className="w-4 h-4" />,
              },
            ]}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
              <Activity className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {filteredLogs.length}
              </p>
              <p className="text-xs text-slate-500">Total Events</p>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-500/20">
              <Shield className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {filteredLogs.filter((l) => l.risk_level === 'critical').length}
              </p>
              <p className="text-xs text-slate-500">Critical</p>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-500/20">
              <Shield className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {filteredLogs.filter((l) => l.risk_level === 'high').length}
              </p>
              <p className="text-xs text-slate-500">High Risk</p>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-500/20">
              <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {filteredLogs.filter((l) => l.risk_level === 'medium').length}
              </p>
              <p className="text-xs text-slate-500">Medium Risk</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <AuditLogFilters users={filterUsers} onFiltersChange={handleFiltersChange} />

      {/* Table */}
      <AuditLogTable
        logs={filteredLogs}
        isLoading={auditFeed.isLoading && logs.length === 0}
        onRowClick={setSelectedLog}
        emptyMessage="No audit logs found matching your filters"
      />

      {/* Detail Sheet */}
      <Sheet open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <SheetContent className="w-[500px] sm:max-w-[500px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Audit Log Details
            </SheetTitle>
            <SheetDescription>
              Full details of the selected audit event
            </SheetDescription>
          </SheetHeader>

          {selectedLog && (
            <div className="mt-6 space-y-6">
              {/* Risk Level */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Risk Level
                </span>
                <RiskLevelBadge level={selectedLog.risk_level} />
              </div>

              {/* Details Grid */}
              <div className="grid gap-4">
                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 mt-0.5 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Timestamp</p>
                    <p className="text-sm text-slate-900 dark:text-white">
                      {format(new Date(selectedLog.created_at), 'PPpp')}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <User className="w-4 h-4 mt-0.5 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Actor</p>
                    <p className="text-sm text-slate-900 dark:text-white">
                      {selectedLog.actor_email || 'System'}
                    </p>
                    {selectedLog.actor_role && (
                      <p className="text-xs text-slate-500">{selectedLog.actor_role}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Activity className="w-4 h-4 mt-0.5 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Action</p>
                    <p className="text-sm text-slate-900 dark:text-white">
                      {selectedLog.action.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                    </p>
                    <p className="text-xs text-slate-500">{selectedLog.action_category}</p>
                  </div>
                </div>

                {selectedLog.target_entity_type && (
                  <div className="flex items-start gap-3">
                    <Hash className="w-4 h-4 mt-0.5 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider">Target</p>
                      <p className="text-sm text-slate-900 dark:text-white">
                        {selectedLog.target_entity_type}
                        {selectedLog.target_entity_id && ` (${selectedLog.target_entity_id.slice(0, 8)}...)`}
                      </p>
                    </div>
                  </div>
                )}

                {selectedLog.ip_address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 mt-0.5 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider">IP Address</p>
                      <p className="text-sm text-slate-900 dark:text-white">
                        {selectedLog.ip_address}
                      </p>
                    </div>
                  </div>
                )}

                {selectedLog.user_agent && (
                  <div className="flex items-start gap-3">
                    <Monitor className="w-4 h-4 mt-0.5 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider">User Agent</p>
                      <p className="text-sm text-slate-900 dark:text-white truncate">
                        {selectedLog.user_agent}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Description */}
              {selectedLog.description && (
                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                    Description
                  </p>
                  <p className="text-sm text-slate-900 dark:text-white">
                    {selectedLog.description}
                  </p>
                </div>
              )}

              {/* Changes */}
              {selectedLog.changes && Object.keys(selectedLog.changes).length > 0 && (
                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                    Changes
                  </p>
                  <pre className="text-xs text-slate-700 dark:text-slate-300 overflow-auto max-h-40">
                    {JSON.stringify(selectedLog.changes, null, 2)}
                  </pre>
                </div>
              )}

              {/* Details */}
              {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                    Additional Details
                  </p>
                  <pre className="text-xs text-slate-700 dark:text-slate-300 overflow-auto max-h-40">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}

              {/* Hash Chain Info */}
              {selectedLog.sequence_number && (
                <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                    Hash Chain Verified
                  </p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">
                    Sequence #{selectedLog.sequence_number}
                  </p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
