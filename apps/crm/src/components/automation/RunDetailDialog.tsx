'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';
import { Button } from '@crm-eco/ui/components/button';
import { Badge } from '@crm-eco/ui/components/badge';
import { ScrollArea } from '@crm-eco/ui/components/scroll-area';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@crm-eco/ui/components/accordion';
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  PlayCircle,
  RefreshCw,
  Clock,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import type { CrmAutomationRun, ActionResult } from '@/lib/automation/types';

interface RunDetailDialogProps {
  run: CrmAutomationRun | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRetrySuccess?: () => void;
}

export function RunDetailDialog({
  run,
  open,
  onOpenChange,
  onRetrySuccess,
}: RunDetailDialogProps) {
  const [retrying, setRetrying] = useState(false);

  if (!run) return null;

  async function handleRetry() {
    if (!run) return;
    
    setRetrying(true);
    try {
      const res = await fetch(`/api/automation/runs/${run.id}/retry`, {
        method: 'POST',
      });

      const result = await res.json();

      if (result.success) {
        toast.success('Workflow retried successfully');
        onRetrySuccess?.();
        onOpenChange(false);
      } else {
        toast.error(result.error || 'Retry failed');
      }
    } catch (error) {
      console.error('Failed to retry:', error);
      toast.error('Failed to retry workflow');
    } finally {
      setRetrying(false);
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'skipped':
        return <AlertCircle className="w-5 h-5 text-amber-500" />;
      case 'running':
        return <PlayCircle className="w-5 h-5 text-blue-500 animate-pulse" />;
      case 'dry_run':
        return <AlertCircle className="w-5 h-5 text-purple-500" />;
      default:
        return <Clock className="w-5 h-5 text-slate-400" />;
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
    assignment: 'Assignment Rule',
    scoring: 'Scoring Rule',
    cadence: 'Cadence',
    sla: 'SLA Policy',
    webform: 'Webform',
    macro: 'Macro',
  };

  const duration = run.completed_at
    ? Math.round((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000)
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getStatusIcon(run.status)}
            Automation Run Details
          </DialogTitle>
          <DialogDescription>
            {run.trigger}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh]">
          <div className="space-y-6 pr-4">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Status</p>
                <div className="mt-1">{getStatusBadge(run.status)}</div>
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Source</p>
                <p className="mt-1 font-medium">{sourceLabels[run.source] || run.source}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Started</p>
                <p className="mt-1 text-sm">{new Date(run.started_at).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Duration</p>
                <p className="mt-1 text-sm">{duration !== null ? `${duration}s` : 'In progress'}</p>
              </div>
            </div>

            {/* Error Message */}
            {run.error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">Error</p>
                <p className="text-sm text-red-600 dark:text-red-300">{run.error}</p>
              </div>
            )}

            {/* Record Link */}
            {run.record_id && (
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Record</p>
                <a
                  href={`/crm/r/${run.record_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-teal-600 hover:underline text-sm"
                >
                  View Record
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {/* Actions Executed */}
            {run.actions_executed && run.actions_executed.length > 0 && (
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                  Actions Executed ({run.actions_executed.length})
                </p>
                <Accordion type="single" collapsible className="w-full">
                  {run.actions_executed.map((action: ActionResult, idx: number) => (
                    <AccordionItem key={idx} value={`action-${idx}`}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-3">
                          {action.status === 'success' && (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          )}
                          {action.status === 'failed' && (
                            <XCircle className="w-4 h-4 text-red-500" />
                          )}
                          {action.status === 'skipped' && (
                            <AlertCircle className="w-4 h-4 text-slate-400" />
                          )}
                          <span className="font-medium">
                            {action.type.replace(/_/g, ' ')}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {action.status}
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2 text-sm">
                          {action.error && (
                            <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded text-red-600 dark:text-red-400">
                              {action.error}
                            </div>
                          )}
                          {action.output && Object.keys(action.output).length > 0 && (
                            <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded">
                              <pre className="text-xs overflow-auto">
                                {JSON.stringify(action.output, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            )}

            {/* Input/Output */}
            {(run.input && Object.keys(run.input).length > 0) && (
              <div>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="input">
                    <AccordionTrigger className="text-sm">
                      Input Data
                    </AccordionTrigger>
                    <AccordionContent>
                      <pre className="text-xs bg-slate-50 dark:bg-slate-800 p-2 rounded overflow-auto">
                        {JSON.stringify(run.input, null, 2)}
                      </pre>
                    </AccordionContent>
                  </AccordionItem>
                  {run.output && Object.keys(run.output).length > 0 && (
                    <AccordionItem value="output">
                      <AccordionTrigger className="text-sm">
                        Output Data
                      </AccordionTrigger>
                      <AccordionContent>
                        <pre className="text-xs bg-slate-50 dark:bg-slate-800 p-2 rounded overflow-auto">
                          {JSON.stringify(run.output, null, 2)}
                        </pre>
                      </AccordionContent>
                    </AccordionItem>
                  )}
                </Accordion>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          {run.status === 'failed' && run.workflow_id && (
            <Button
              variant="outline"
              onClick={handleRetry}
              disabled={retrying}
            >
              {retrying ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Retry
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
