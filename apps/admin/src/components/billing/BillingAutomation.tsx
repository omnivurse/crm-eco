'use client';

import { CircleNotch, GearSix, Play, ShieldCheck, ShieldSlash } from '@phosphor-icons/react';
import { useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@crm-eco/ui';
interface AutomationConfig {
  id: string;
  billing_enabled: boolean;
  commission_enabled: boolean;
  run_day_of_month: number;
  run_hour_utc: number;
  batch_size: number;
  max_retries: number;
  circuit_breaker_threshold: number;
  circuit_breaker_cooldown: number;
  rate_limit_per_minute: number;
  notify_on_failure: boolean;
  notify_email: string | null;
}

interface JobRun {
  id: string;
  job_type: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  processed_count: number;
  success_count: number;
  failure_count: number;
  skipped_count: number;
  triggered_by: string;
  error_log: string[];
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    running: 'bg-blue-100 text-blue-800 animate-pulse',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-800',
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status] || styles.cancelled}`}>
      {status}
    </span>
  );
}

function TriggerBadge({ trigger }: { trigger: string }) {
  const styles: Record<string, string> = {
    cron: 'bg-purple-100 text-purple-700',
    manual: 'bg-amber-100 text-amber-700',
    api: 'bg-indigo-100 text-indigo-700',
    smoke_test: 'bg-gray-100 text-gray-600',
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${styles[trigger] || styles.api}`}>
      {trigger}
    </span>
  );
}

export function BillingAutomationCard({ config }: { config: AutomationConfig | null }) {
  if (!config) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <GearSix weight="light" className="h-5 w-5" />
            Billing Automation
          </CardTitle>
          <CardDescription>Not configured for this organization</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">
            Billing automation has not been set up. Contact an administrator to configure
            automated billing processing.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <GearSix weight="light" className="h-5 w-5" />
          Billing Automation
        </CardTitle>
        <CardDescription>Automated billing and commission processing configuration</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Billing Status */}
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="flex items-center gap-2">
              {config.billing_enabled ? (
                <ShieldCheck weight="light" className="h-4 w-4 text-green-600" />
              ) : (
                <ShieldSlash weight="light" className="h-4 w-4 text-gray-400" />
              )}
              <span className="text-sm font-medium">Billing Processing</span>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${
              config.billing_enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
            }`}>
              {config.billing_enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>

          {/* Commission Status */}
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="flex items-center gap-2">
              {config.commission_enabled ? (
                <ShieldCheck weight="light" className="h-4 w-4 text-green-600" />
              ) : (
                <ShieldSlash weight="light" className="h-4 w-4 text-gray-400" />
              )}
              <span className="text-sm font-medium">Commission Processing</span>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${
              config.commission_enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
            }`}>
              {config.commission_enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>

          {/* Schedule */}
          <div className="p-3 rounded-lg border">
            <p className="text-xs text-slate-500 mb-1">Run Schedule</p>
            <p className="text-sm font-medium">
              Day {config.run_day_of_month} at {String(config.run_hour_utc).padStart(2, '0')}:00 UTC
            </p>
          </div>

          {/* Batch Config */}
          <div className="p-3 rounded-lg border">
            <p className="text-xs text-slate-500 mb-1">Batch Config</p>
            <p className="text-sm font-medium">
              {config.batch_size} per batch • {config.max_retries} max retries
            </p>
          </div>

          {/* Circuit Breaker */}
          <div className="p-3 rounded-lg border">
            <p className="text-xs text-slate-500 mb-1">Circuit Breaker</p>
            <p className="text-sm font-medium">
              Trips at {config.circuit_breaker_threshold} failures • {config.circuit_breaker_cooldown}s cooldown
            </p>
          </div>

          {/* Rate Limit */}
          <div className="p-3 rounded-lg border">
            <p className="text-xs text-slate-500 mb-1">Rate Limit</p>
            <p className="text-sm font-medium">
              {config.rate_limit_per_minute} charges/min
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function JobRunHistoryCard({ jobRuns }: { jobRuns: JobRun[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Play weight="light" className="h-5 w-5" />
          Recent Job Runs
        </CardTitle>
        <CardDescription>Billing and commission processing history</CardDescription>
      </CardHeader>
      <CardContent>
        {jobRuns.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="pb-2 pr-4 font-medium">Type</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Trigger</th>
                  <th className="pb-2 pr-4 font-medium text-right">Processed</th>
                  <th className="pb-2 pr-4 font-medium text-right">✓</th>
                  <th className="pb-2 pr-4 font-medium text-right">✗</th>
                  <th className="pb-2 pr-4 font-medium text-right">Duration</th>
                  <th className="pb-2 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {jobRuns.map((run) => (
                  <tr key={run.id} className="border-b last:border-b-0 hover:bg-slate-50">
                    <td className="py-2 pr-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        run.job_type === 'billing' ? 'bg-amber-100 text-amber-800' : 'bg-violet-100 text-violet-800'
                      }`}>
                        {run.job_type}
                      </span>
                    </td>
                    <td className="py-2 pr-4"><StatusBadge status={run.status} /></td>
                    <td className="py-2 pr-4"><TriggerBadge trigger={run.triggered_by} /></td>
                    <td className="py-2 pr-4 text-right font-mono">{run.processed_count}</td>
                    <td className="py-2 pr-4 text-right font-mono text-green-600">{run.success_count}</td>
                    <td className="py-2 pr-4 text-right font-mono text-red-600">{run.failure_count}</td>
                    <td className="py-2 pr-4 text-right font-mono text-slate-500">
                      {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : '—'}
                    </td>
                    <td className="py-2 text-slate-500 text-xs">
                      {new Date(run.started_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <Play weight="light" className="h-8 w-8 mx-auto mb-2 text-slate-300" />
            No job runs recorded yet
          </div>
        )}
      </CardContent>
    </Card>
  );
}
