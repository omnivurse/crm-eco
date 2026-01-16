'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@crm-eco/ui';
import {
  ClipboardCheck,
  Plus,
  ArrowLeft,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  Shield,
  GitBranch,
} from 'lucide-react';

interface ApprovalProcess {
  id: string;
  name: string;
  description: string | null;
  is_enabled: boolean;
  trigger_type: string;
  steps: Array<{ type: string; value: string }>;
  module: { name: string; key: string } | null;
  created_at: string;
}

interface ApprovalRule {
  id: string;
  name: string;
  description: string | null;
  is_enabled: boolean;
  trigger_type: string;
  priority: number;
  process: { name: string } | null;
  module: { name: string; key: string } | null;
}

export default function ApprovalsSettingsPage() {
  const router = useRouter();
  const [processes, setProcesses] = useState<ApprovalProcess[]>([]);
  const [rules, setRules] = useState<ApprovalRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteProcessId, setDeleteProcessId] = useState<string | null>(null);
  const [deleteRuleId, setDeleteRuleId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [processesRes, rulesRes] = await Promise.all([
        fetch('/api/approvals/processes'),
        fetch('/api/approvals/rules'),
      ]);

      if (processesRes.ok) {
        const data = await processesRes.json();
        setProcesses(data.processes || []);
      }

      if (rulesRes.ok) {
        const data = await rulesRes.json();
        setRules(data.rules || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleToggleProcess(processId: string, currentEnabled: boolean) {
    setTogglingId(processId);
    try {
      const res = await fetch('/api/approvals/processes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: processId, is_enabled: !currentEnabled }),
      });
      if (res.ok) {
        setProcesses(processes.map(p =>
          p.id === processId ? { ...p, is_enabled: !currentEnabled } : p
        ));
      }
    } catch (error) {
      console.error('Failed to toggle process:', error);
    } finally {
      setTogglingId(null);
    }
  }

  async function handleToggleRule(ruleId: string, currentEnabled: boolean) {
    setTogglingId(ruleId);
    try {
      const res = await fetch('/api/approvals/rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ruleId, is_enabled: !currentEnabled }),
      });
      if (res.ok) {
        setRules(rules.map(r =>
          r.id === ruleId ? { ...r, is_enabled: !currentEnabled } : r
        ));
      }
    } catch (error) {
      console.error('Failed to toggle rule:', error);
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDeleteProcess() {
    if (!deleteProcessId) return;
    try {
      const res = await fetch(`/api/approvals/processes?id=${deleteProcessId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setProcesses(processes.filter(p => p.id !== deleteProcessId));
      }
    } catch (error) {
      console.error('Failed to delete process:', error);
    } finally {
      setDeleteProcessId(null);
    }
  }

  async function handleDeleteRule() {
    if (!deleteRuleId) return;
    try {
      const res = await fetch(`/api/approvals/rules?id=${deleteRuleId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setRules(rules.filter(r => r.id !== deleteRuleId));
      }
    } catch (error) {
      console.error('Failed to delete rule:', error);
    } finally {
      setDeleteRuleId(null);
    }
  }

  const triggerLabels: Record<string, string> = {
    stage_transition: 'Stage Transition',
    field_change: 'Field Change',
    record_create: 'Record Create',
    record_delete: 'Record Delete',
    field_threshold: 'Field Threshold',
    manual: 'Manual',
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
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <ClipboardCheck className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Approval Processes</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Configure multi-step approval workflows
              </p>
            </div>
          </div>
        </div>
        <Button onClick={() => router.push('/crm/settings/automations/approvals/new')}>
          <Plus className="w-4 h-4 mr-2" />
          Create Process
        </Button>
      </div>

      {/* Approval Processes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="w-5 h-5" />
            Approval Processes
          </CardTitle>
          <CardDescription>
            Define the steps and approvers for each approval workflow
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : processes.length === 0 ? (
            <div className="text-center py-12">
              <GitBranch className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                No approval processes yet
              </h3>
              <p className="text-slate-500 dark:text-slate-400 mb-4">
                Create your first approval process to require approvals for sensitive actions
              </p>
              <Button onClick={() => router.push('/crm/settings/automations/approvals/new')}>
                <Plus className="w-4 h-4 mr-2" />
                Create Process
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Steps</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processes.map((process) => (
                  <TableRow key={process.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium text-slate-900 dark:text-white">
                          {process.name}
                        </div>
                        {process.description && (
                          <div className="text-sm text-slate-500 dark:text-slate-400">
                            {process.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {process.module?.name || 'Unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {triggerLabels[process.trigger_type] || process.trigger_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-slate-600 dark:text-slate-400">
                        {process.steps?.length || 0} step{(process.steps?.length || 0) !== 1 ? 's' : ''}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={process.is_enabled}
                        onCheckedChange={() => handleToggleProcess(process.id, process.is_enabled)}
                        disabled={togglingId === process.id}
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
                          <DropdownMenuItem onClick={() => router.push(`/crm/settings/automations/approvals/${process.id}`)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => setDeleteProcessId(process.id)}
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
        </CardContent>
      </Card>

      {/* Approval Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Approval Rules
          </CardTitle>
          <CardDescription>
            Define conditions that trigger approval requirements
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : rules.length === 0 ? (
            <div className="text-center py-8">
              <Shield className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400">
                No approval rules configured. Rules automatically trigger approval processes based on conditions.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Process</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium text-slate-900 dark:text-white">
                          {rule.name}
                        </div>
                        {rule.description && (
                          <div className="text-sm text-slate-500 dark:text-slate-400">
                            {rule.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {rule.module?.name || 'Unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{rule.process?.name || 'Unknown'}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {triggerLabels[rule.trigger_type] || rule.trigger_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-slate-600 dark:text-slate-400">{rule.priority}</span>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={rule.is_enabled}
                        onCheckedChange={() => handleToggleRule(rule.id, rule.is_enabled)}
                        disabled={togglingId === rule.id}
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
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => setDeleteRuleId(rule.id)}
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
        </CardContent>
      </Card>

      {/* Delete Process Dialog */}
      <AlertDialog open={!!deleteProcessId} onOpenChange={() => setDeleteProcessId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Approval Process</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this approval process? Any associated rules will also be deleted.
              Existing approval requests will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProcess}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Rule Dialog */}
      <AlertDialog open={!!deleteRuleId} onOpenChange={() => setDeleteRuleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Approval Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this approval rule? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRule}
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
