'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@crm-eco/ui/components/table';
import { Badge } from '@crm-eco/ui/components/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { Input } from '@crm-eco/ui/components/input';
import {
  History,
  ArrowLeft,
  Search,
  Filter,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  PlayCircle,
  Eye,
} from 'lucide-react';
import type { CrmAutomationRun } from '@/lib/automation/types';

export default function AutomationRunsPage() {
  const [runs, setRuns] = useState<CrmAutomationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  useEffect(() => {
    fetchRuns();
  }, [statusFilter, sourceFilter]);

  async function fetchRuns() {
    try {
      // This would need a new API endpoint
      setRuns([]);
    } catch (error) {
      console.error('Failed to fetch runs:', error);
    } finally {
      setLoading(false);
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'skipped':
        return <AlertCircle className="w-4 h-4 text-amber-500" />;
      case 'running':
        return <PlayCircle className="w-4 h-4 text-blue-500 animate-pulse" />;
      case 'dry_run':
        return <Eye className="w-4 h-4 text-purple-500" />;
      default:
        return null;
    }
  }

  function getStatusBadge(status: string) {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      success: 'default',
      failed: 'destructive',
      skipped: 'secondary',
      running: 'outline',
      dry_run: 'secondary',
    };
    return (
      <Badge variant={variants[status] || 'outline'} className="gap-1">
        {getStatusIcon(status)}
        {status.replace('_', ' ')}
      </Badge>
    );
  }

  const sourceLabels: Record<string, string> = {
    workflow: 'Workflow',
    assignment: 'Assignment',
    scoring: 'Scoring',
    cadence: 'Cadence',
    sla: 'SLA',
    webform: 'Webform',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/crm/settings/automations">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-500/10 rounded-lg">
              <History className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Automation Runs</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                View execution history and audit logs
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Search runs..." className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="skipped">Skipped</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="dry_run">Dry Run</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="workflow">Workflow</SelectItem>
            <SelectItem value="assignment">Assignment</SelectItem>
            <SelectItem value="scoring">Scoring</SelectItem>
            <SelectItem value="cadence">Cadence</SelectItem>
            <SelectItem value="sla">SLA</SelectItem>
            <SelectItem value="webform">Webform</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Runs Table */}
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : runs.length === 0 ? (
          <div className="text-center py-12">
            <History className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
              No automation runs yet
            </h3>
            <p className="text-slate-500 dark:text-slate-400">
              Runs will appear here when automations execute
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Record</TableHead>
                <TableHead>Actions</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <TableRow key={run.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <TableCell>{getStatusBadge(run.status)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {sourceLabels[run.source] || run.source}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-600 dark:text-slate-400">
                    {run.trigger}
                  </TableCell>
                  <TableCell>
                    {run.record_id ? (
                      <Link
                        href={`/crm/r/${run.record_id}`}
                        className="text-teal-600 hover:underline"
                      >
                        View Record
                      </Link>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {run.actions_executed?.length || 0} executed
                  </TableCell>
                  <TableCell className="text-slate-600 dark:text-slate-400">
                    {new Date(run.started_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-slate-600 dark:text-slate-400">
                    {run.completed_at
                      ? `${Math.round((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000)}s`
                      : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
