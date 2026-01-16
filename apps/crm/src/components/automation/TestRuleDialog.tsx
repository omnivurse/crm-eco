'use client';

import { useState } from 'react';
import { Button } from '@crm-eco/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { Badge } from '@crm-eco/ui/components/badge';
import {
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Search,
} from 'lucide-react';
import type { AutomationRunResult, ActionResult } from '@/lib/automation/types';

interface TestRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowId: string;
  workflowName: string;
}

export function TestRuleDialog({
  open,
  onOpenChange,
  workflowId,
  workflowName,
}: TestRuleDialogProps) {
  const [recordId, setRecordId] = useState('');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<AutomationRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runTest() {
    if (!recordId) return;

    setTesting(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/automation/run?workflowId=${workflowId}&recordId=${recordId}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to test workflow');
        return;
      }

      setResult(data.result);
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

  function getActionStatusBadge(status: string) {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      success: 'default',
      failed: 'destructive',
      skipped: 'secondary',
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="w-5 h-5 text-teal-500" />
            Test Workflow
          </DialogTitle>
          <DialogDescription>
            Test "{workflowName}" in dry-run mode against a record
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Record ID Input */}
          <div>
            <Label htmlFor="recordId">Record ID</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="recordId"
                value={recordId}
                onChange={(e) => setRecordId(e.target.value)}
                placeholder="Enter a record UUID"
                className="flex-1"
              />
              <Button
                onClick={runTest}
                disabled={!recordId || testing}
              >
                {testing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              No changes will be made in dry-run mode
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <XCircle className="w-4 h-4" />
                <span className="font-medium">Error</span>
              </div>
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-4">
              {/* Status */}
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                {getStatusIcon(result.status)}
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">
                    {result.status === 'dry_run' ? 'Dry Run Complete' :
                     result.status === 'success' ? 'Would Execute Successfully' :
                     result.status === 'skipped' ? 'Would Be Skipped' : 'Would Fail'}
                  </p>
                  {result.error && (
                    <p className="text-sm text-red-500">{result.error}</p>
                  )}
                </div>
              </div>

              {/* Actions */}
              {result.actionsExecuted && result.actionsExecuted.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-2">
                    Actions that would execute:
                  </h4>
                  <div className="space-y-2">
                    {result.actionsExecuted.map((action, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 border border-slate-200 dark:border-slate-700 rounded"
                      >
                        <span className="text-sm font-medium text-slate-900 dark:text-white">
                          {action.type.replace('_', ' ')}
                        </span>
                        {getActionStatusBadge(action.status)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Output Preview */}
              {result.actionsExecuted && result.actionsExecuted.some(a => a.output) && (
                <div>
                  <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-2">
                    Predicted Output:
                  </h4>
                  <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg text-xs overflow-auto max-h-48">
                    {JSON.stringify(
                      result.actionsExecuted.map(a => ({ type: a.type, output: a.output })),
                      null,
                      2
                    )}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
