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
  Zap,
  Plus,
  ArrowLeft,
  MoreHorizontal,
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
import type { CrmMacro } from '@/lib/automation/types';

export default function MacrosPage() {
  const router = useRouter();
  const [macros, setMacros] = useState<CrmMacro[]>([]);
  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState<Record<string, string>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchMacros = useCallback(async () => {
    try {
      // Fetch modules first
      const modulesRes = await fetch('/api/crm/modules');
      const modulesData = await modulesRes.json();
      const moduleMap: Record<string, string> = {};
      modulesData.forEach((m: { id: string; name: string }) => {
        moduleMap[m.id] = m.name;
      });
      setModules(moduleMap);

      // Fetch macros
      const macrosRes = await fetch('/api/automation/macros');
      if (macrosRes.ok) {
        const macrosData = await macrosRes.json();
        setMacros(macrosData);
      }
    } catch (error) {
      console.error('Failed to fetch macros:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMacros();
  }, [fetchMacros]);

  async function handleToggleMacro(macroId: string, currentEnabled: boolean) {
    setTogglingId(macroId);
    try {
      const res = await fetch(`/api/automation/macros/${macroId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_enabled: !currentEnabled }),
      });
      if (res.ok) {
        setMacros(macros.map(m => 
          m.id === macroId ? { ...m, is_enabled: !currentEnabled } : m
        ));
      }
    } catch (error) {
      console.error('Failed to toggle macro:', error);
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDeleteMacro() {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/automation/macros/${deleteId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setMacros(macros.filter(m => m.id !== deleteId));
      }
    } catch (error) {
      console.error('Failed to delete macro:', error);
    } finally {
      setDeleteId(null);
    }
  }

  async function handleDuplicateMacro(macro: CrmMacro) {
    try {
      const res = await fetch('/api/automation/macros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module_id: macro.module_id,
          name: `${macro.name} (Copy)`,
          description: macro.description,
          icon: macro.icon,
          color: macro.color,
          actions: macro.actions,
          is_enabled: false,
          allowed_roles: macro.allowed_roles,
        }),
      });
      if (res.ok) {
        fetchMacros();
      }
    } catch (error) {
      console.error('Failed to duplicate macro:', error);
    }
  }

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
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Zap className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Macros</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                One-click action bundles for quick record operations
              </p>
            </div>
          </div>
        </div>
        <Button onClick={() => router.push('/crm/settings/automations/macros/new')}>
          <Plus className="w-4 h-4 mr-2" />
          Create Macro
        </Button>
      </div>

      {/* Macros Table */}
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : macros.length === 0 ? (
          <div className="text-center py-12">
            <Zap className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
              No macros yet
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              Create your first macro to enable one-click actions
            </p>
            <Button onClick={() => router.push('/crm/settings/automations/macros/new')}>
              <Plus className="w-4 h-4 mr-2" />
              Create Macro
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Actions</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {macros.map((macro) => (
                <TableRow key={macro.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${macro.color}20` }}
                      >
                        <Zap className="w-4 h-4" style={{ color: macro.color }} />
                      </div>
                      <div>
                        <div className="font-medium text-slate-900 dark:text-white">
                          {macro.name}
                        </div>
                        {macro.description && (
                          <div className="text-sm text-slate-500 dark:text-slate-400">
                            {macro.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {modules[macro.module_id] || 'Unknown'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-slate-600 dark:text-slate-400">
                      {macro.actions.length} action{macro.actions.length !== 1 ? 's' : ''}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {macro.allowed_roles.slice(0, 2).map(role => (
                        <Badge key={role} variant="secondary" className="text-xs">
                          {role.replace('crm_', '')}
                        </Badge>
                      ))}
                      {macro.allowed_roles.length > 2 && (
                        <Badge variant="secondary" className="text-xs">
                          +{macro.allowed_roles.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch 
                      checked={macro.is_enabled} 
                      onCheckedChange={() => handleToggleMacro(macro.id, macro.is_enabled)}
                      disabled={togglingId === macro.id}
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
                        <DropdownMenuItem onClick={() => router.push(`/crm/settings/automations/macros/${macro.id}`)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicateMacro(macro)}>
                          <Copy className="w-4 h-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-red-600"
                          onClick={() => setDeleteId(macro.id)}
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
            <AlertDialogTitle>Delete Macro</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this macro? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMacro}
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
