'use client';

import { useState, useEffect } from 'react';
import { Button } from '@crm-eco/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@crm-eco/ui/components/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';
import { Badge } from '@crm-eco/ui/components/badge';
import {
  Zap,
  ChevronDown,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import type { CrmMacro, ActionResult } from '@/lib/automation/types';

interface MacroRunnerProps {
  recordId: string;
  moduleId: string;
  onSuccess?: () => void;
}

interface MacroExecutionResult {
  success: boolean;
  runId: string;
  macroId: string;
  macroName: string;
  status: 'success' | 'failed' | 'partial';
  actionsExecuted: ActionResult[];
  error?: string;
}

export function MacroRunner({ recordId, moduleId, onSuccess }: MacroRunnerProps) {
  const [macros, setMacros] = useState<CrmMacro[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState<string | null>(null);
  const [resultDialog, setResultDialog] = useState<MacroExecutionResult | null>(null);

  useEffect(() => {
    fetchMacros();
  }, [moduleId]);

  async function fetchMacros() {
    try {
      const res = await fetch(`/api/automation/macros?module_id=${moduleId}`);
      if (res.ok) {
        const data = await res.json();
        setMacros(data.filter((m: CrmMacro) => m.is_enabled));
      }
    } catch (error) {
      console.error('Failed to fetch macros:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRunMacro(macro: CrmMacro) {
    setExecuting(macro.id);
    try {
      const res = await fetch(`/api/automation/macros/${macro.id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId }),
      });

      const result = await res.json();

      if (result.success) {
        toast.success(`Macro "${macro.name}" executed successfully`);
        onSuccess?.();
      } else {
        toast.error(result.error || 'Macro execution failed');
      }

      // Show detailed result dialog
      setResultDialog(result);
    } catch (error) {
      console.error('Failed to execute macro:', error);
      toast.error('Failed to execute macro');
    } finally {
      setExecuting(null);
    }
  }

  if (loading) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        Loading...
      </Button>
    );
  }

  if (macros.length === 0) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Zap className="w-4 h-4 mr-2" />
            Run Macro
            <ChevronDown className="w-4 h-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Available Macros</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {macros.map((macro) => (
            <DropdownMenuItem
              key={macro.id}
              onClick={() => handleRunMacro(macro)}
              disabled={executing !== null}
            >
              <div className="flex items-center gap-2 w-full">
                <div 
                  className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${macro.color}20` }}
                >
                  {executing === macro.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" style={{ color: macro.color }} />
                  ) : (
                    <Zap className="w-3 h-3" style={{ color: macro.color }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{macro.name}</p>
                  {macro.description && (
                    <p className="text-xs text-slate-500 truncate">{macro.description}</p>
                  )}
                </div>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Result Dialog */}
      <Dialog open={!!resultDialog} onOpenChange={() => setResultDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {resultDialog?.status === 'success' && (
                <CheckCircle className="w-5 h-5 text-green-500" />
              )}
              {resultDialog?.status === 'failed' && (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              {resultDialog?.status === 'partial' && (
                <AlertCircle className="w-5 h-5 text-amber-500" />
              )}
              Macro Execution Result
            </DialogTitle>
            <DialogDescription>
              {resultDialog?.macroName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600 dark:text-slate-400">Status:</span>
              <Badge 
                variant={
                  resultDialog?.status === 'success' ? 'default' :
                  resultDialog?.status === 'failed' ? 'destructive' : 'secondary'
                }
              >
                {resultDialog?.status}
              </Badge>
            </div>

            {resultDialog?.error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-700 dark:text-red-400">{resultDialog.error}</p>
              </div>
            )}

            {resultDialog?.actionsExecuted && resultDialog.actionsExecuted.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Actions Executed:</h4>
                <div className="space-y-2">
                  {resultDialog.actionsExecuted.map((action, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded"
                    >
                      <div className="flex items-center gap-2">
                        {action.status === 'success' && (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                        {action.status === 'failed' && (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                        {action.status === 'skipped' && (
                          <AlertCircle className="w-4 h-4 text-slate-400" />
                        )}
                        <span className="text-sm">{action.type.replace(/_/g, ' ')}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {action.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setResultDialog(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
