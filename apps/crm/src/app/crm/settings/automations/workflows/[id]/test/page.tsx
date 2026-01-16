'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { Badge } from '@crm-eco/ui/components/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@crm-eco/ui/components/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@crm-eco/ui/components/table';
import {
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowLeft,
  Search,
  GitBranch,
  Zap,
  History,
  RefreshCw,
} from 'lucide-react';
import type { CrmWorkflow } from '@/lib/automation/types';
import type { AutomationRunResult } from '@/lib/automation/types';

interface TestResult {
  recordId: string;
  result: AutomationRunResult;
  timestamp: Date;
}

export default function TestWorkflowPage() {
  const router = useRouter();
  const params = useParams();
  const workflowId = params.id as string;

  const [workflow, setWorkflow] = useState<CrmWorkflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [recordId, setRecordId] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [recentRecords, setRecentRecords] = useState<{ id: string; title: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWorkflow();
  }, [workflowId]);

  async function fetchWorkflow() {
    try {
      const res = await fetch(`/api/automation/workflows/${workflowId}`);
      if (!res.ok) {
        throw new Error('Failed to load workflow');
      }
      const data = await res.json();
      setWorkflow(data);

      // Fetch recent records for this module
      if (data.module_id) {
        const recordsRes = await fetch(`/api/crm/records?moduleId=${data.module_id}&limit=10`);
        if (recordsRes.ok) {
          const recordsData = await recordsRes.json();
          setRecentRecords(
            (recordsData.records || []).map((r: any) => ({
              id: r.id,
              title: r.title || r.data?.name || r.data?.first_name || r.id.slice(0, 8),
            }))
          );
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workflow');
    } finally {
      setLoading(false);
    }
  }

  async function runTest(recordIdToTest: string) {
    if (!recordIdToTest) return;

    setTesting(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/automation/run?workflowId=${workflowId}&recordId=${recordIdToTest}`
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to test workflow');
        return;
      }

      setTestResults((prev) => [
        {
          recordId: recordIdToTest,
          result: data.result,
          timestamp: new Date(),
        },
        ...prev.slice(0, 9), // Keep last 10 results
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setTesting(false);
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'success':
      case 'dry_run':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'skipped':
        return <AlertCircle className="w-5 h-5 text-amber-500" />;
      default:
        return null;
    }
  }

  function getStatusBadge(status: string) {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      success: 'default',
      dry_run: 'default',
      failed: 'destructive',
      skipped: 'secondary',
    };
    return (
      <Badge variant={variants[status] || 'outline'} className="gap-1">
        {getStatusIcon(status)}
        {status === 'dry_run' ? 'Dry Run OK' : status}
      </Badge>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error && !workflow) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-red-500 mb-4">{error}</p>
        <Link href="/crm/settings/automations/workflows" className="text-teal-600 hover:underline">
          Back to Workflows
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/crm/settings/automations/workflows">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Play className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                Test Workflow
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {workflow?.name}
              </p>
            </div>
          </div>
        </div>
        <Link href={`/crm/settings/automations/workflows/${workflowId}`}>
          <Button variant="outline">
            <GitBranch className="w-4 h-4 mr-2" />
            Edit Workflow
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Test Panel */}
        <div className="lg:col-span-1 space-y-6">
          {/* Manual Test */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                Run Test
              </CardTitle>
              <CardDescription>
                Test the workflow in dry-run mode (no changes made)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="recordId">Record ID</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="recordId"
                    value={recordId}
                    onChange={(e) => setRecordId(e.target.value)}
                    placeholder="Enter record UUID"
                    className="flex-1"
                  />
                  <Button
                    onClick={() => runTest(recordId)}
                    disabled={!recordId || testing}
                  >
                    {testing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Select */}
          {recentRecords.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Search className="w-4 h-4 text-blue-500" />
                  Recent Records
                </CardTitle>
                <CardDescription>Click to test with a record</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recentRecords.map((record) => (
                    <button
                      key={record.id}
                      onClick={() => {
                        setRecordId(record.id);
                        runTest(record.id);
                      }}
                      disabled={testing}
                      className="w-full text-left p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-teal-500 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors"
                    >
                      <p className="font-medium text-slate-900 dark:text-white text-sm truncate">
                        {record.title}
                      </p>
                      <p className="text-xs text-slate-500 font-mono truncate">
                        {record.id}
                      </p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Workflow Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workflow Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Trigger</span>
                <Badge variant="outline">{workflow?.trigger_type}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Status</span>
                <Badge variant={workflow?.is_enabled ? 'default' : 'secondary'}>
                  {workflow?.is_enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Conditions</span>
                <span className="text-slate-900 dark:text-white">
                  {Array.isArray(workflow?.conditions)
                    ? workflow.conditions.length
                    : (workflow?.conditions as any)?.conditions?.length || 0}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Actions</span>
                <span className="text-slate-900 dark:text-white">
                  {workflow?.actions?.length || 0}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-500" />
                  Test Results
                </CardTitle>
                <CardDescription>Results from your test runs</CardDescription>
              </div>
              {testResults.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTestResults([])}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Clear
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {testResults.length === 0 ? (
                <div className="text-center py-12">
                  <Play className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                    No test results yet
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400">
                    Enter a record ID and run a test to see results
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {testResults.map((test, index) => (
                    <div
                      key={index}
                      className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden"
                    >
                      {/* Result Header */}
                      <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(test.result.status)}
                          <div>
                            <p className="font-medium text-slate-900 dark:text-white">
                              {test.result.status === 'dry_run'
                                ? 'Dry Run Completed'
                                : test.result.status === 'success'
                                ? 'Would Execute'
                                : test.result.status === 'skipped'
                                ? 'Would Be Skipped'
                                : 'Would Fail'}
                            </p>
                            <p className="text-xs text-slate-500 font-mono">
                              {test.recordId}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          {getStatusBadge(test.result.status)}
                          <p className="text-xs text-slate-500 mt-1">
                            {test.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                      </div>

                      {/* Actions Executed */}
                      {test.result.actionsExecuted &&
                        test.result.actionsExecuted.length > 0 && (
                          <div className="p-4">
                            <p className="text-sm font-medium text-slate-900 dark:text-white mb-2">
                              Actions ({test.result.actionsExecuted.length})
                            </p>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Action</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Output</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {test.result.actionsExecuted.map((action, actionIndex) => (
                                  <TableRow key={actionIndex}>
                                    <TableCell className="font-medium">
                                      {action.type.replace(/_/g, ' ')}
                                    </TableCell>
                                    <TableCell>
                                      <Badge
                                        variant={
                                          action.status === 'success'
                                            ? 'default'
                                            : action.status === 'failed'
                                            ? 'destructive'
                                            : 'secondary'
                                        }
                                      >
                                        {action.status}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs font-mono text-slate-500 max-w-xs truncate">
                                      {action.output
                                        ? JSON.stringify(action.output).slice(0, 50)
                                        : action.error || '-'}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}

                      {/* Error Message */}
                      {test.result.error && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800">
                          <p className="text-sm text-red-600 dark:text-red-400">
                            {test.result.error}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
