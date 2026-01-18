'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@crm-eco/ui/components/button';
import { Switch } from '@crm-eco/ui/components/switch';
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
  GitBranch,
  Plus,
  ArrowLeft,
  MoreHorizontal,
  Play,
  Pencil,
  Trash2,
  Loader2,
  Copy,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@crm-eco/ui/components/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@crm-eco/ui/components/alert-dialog';
import type { CrmWorkflow } from '@/lib/automation/types';

export default function WorkflowsPage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<CrmWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState<Record<string, string>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchWorkflows = useCallback(async () => {
    try {
      // Fetch modules first
      const modulesRes = await fetch('/api/crm/modules');
      if (modulesRes.ok) {
        const modulesData = await modulesRes.json();
        const moduleMap: Record<string, string> = {};
        if (Array.isArray(modulesData)) {
          modulesData.forEach((m: { id: string; name: string }) => {
            moduleMap[m.id] = m.name;
          });
        }
        setModules(moduleMap);
      }

      // Fetch workflows from API
      const workflowsRes = await fetch('/api/automation/workflows');
      if (workflowsRes.ok) {
        const workflowsData = await workflowsRes.json();
        if (Array.isArray(workflowsData)) {
          setWorkflows(workflowsData);
        }
      }
    } catch (error) {
      console.error('Failed to fetch workflows:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  async function handleToggleWorkflow(workflowId: string, currentEnabled: boolean) {
    setTogglingId(workflowId);
    try {
      const res = await fetch(`/api/automation/workflows/${workflowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_enabled: !currentEnabled }),
      });
      if (res.ok) {
        setWorkflows(workflows.map(w => 
          w.id === workflowId ? { ...w, is_enabled: !currentEnabled } : w
        ));
      }
    } catch (error) {
      console.error('Failed to toggle workflow:', error);
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDeleteWorkflow() {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/automation/workflows/${deleteId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setWorkflows(workflows.filter(w => w.id !== deleteId));
      }
    } catch (error) {
      console.error('Failed to delete workflow:', error);
    } finally {
      setDeleteId(null);
    }
  }

  async function handleDuplicateWorkflow(workflow: CrmWorkflow) {
    try {
      const res = await fetch('/api/automation/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module_id: workflow.module_id,
          name: `${workflow.name} (Copy)`,
          description: workflow.description,
          trigger_type: workflow.trigger_type,
          trigger_config: workflow.trigger_config,
          conditions: workflow.conditions,
          actions: workflow.actions,
          is_enabled: false, // Start disabled
          priority: workflow.priority,
        }),
      });
      if (res.ok) {
        fetchWorkflows();
      }
    } catch (error) {
      console.error('Failed to duplicate workflow:', error);
    }
  }

  const triggerLabels: Record<string, string> = {
    on_create: 'On Create',
    on_update: 'On Update',
    scheduled: 'Scheduled',
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
            <div className="p-2 bg-teal-500/10 rounded-lg">
              <GitBranch className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Workflows</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Automate actions when records change
              </p>
            </div>
          </div>
        </div>
        <Button onClick={() => router.push('/crm/settings/automations/workflows/new')}>
          <Plus className="w-4 h-4 mr-2" />
          Create Workflow
        </Button>
      </div>

      {/* Workflows Table */}
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : workflows.length === 0 ? (
          <div className="text-center py-12">
            <GitBranch className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
              No workflows yet
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              Create your first workflow to automate CRM actions
            </p>
            <Button onClick={() => router.push('/crm/settings/automations/workflows/new')}>
              <Plus className="w-4 h-4 mr-2" />
              Create Workflow
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Actions</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workflows.map((workflow) => (
                <TableRow key={workflow.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">
                        {workflow.name}
                      </div>
                      {workflow.description && (
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          {workflow.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {modules[workflow.module_id] || 'Unknown'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {triggerLabels[workflow.trigger_type] || workflow.trigger_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-slate-600 dark:text-slate-400">
                      {workflow.actions.length} action{workflow.actions.length !== 1 ? 's' : ''}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Switch 
                      checked={workflow.is_enabled} 
                      onCheckedChange={() => handleToggleWorkflow(workflow.id, workflow.is_enabled)}
                      disabled={togglingId === workflow.id}
                    />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/crm/settings/automations/workflows/${workflow.id}`)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicateWorkflow(workflow)}>
                          <Copy className="w-4 h-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push(`/crm/settings/automations/workflows/${workflow.id}/test`)}>
                          <Play className="w-4 h-4 mr-2" />
                          Test
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-red-600"
                          onClick={() => setDeleteId(workflow.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workflow</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this workflow? This action cannot be undone.
              Any automation runs history will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteWorkflow}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
