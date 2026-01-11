'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
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
  Timer,
  Plus,
  ArrowLeft,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  Mail,
  Phone,
  CheckSquare,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import type { CrmCadence, CadenceStep } from '@/lib/automation/types';

export default function CadencesPage() {
  const [cadences, setCadences] = useState<CrmCadence[]>([]);
  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchCadences();
  }, []);

  async function fetchCadences() {
    try {
      const res = await fetch('/api/crm/modules');
      const modulesData = await res.json();
      const moduleMap: Record<string, string> = {};
      modulesData.forEach((m: { id: string; name: string }) => {
        moduleMap[m.id] = m.name;
      });
      setModules(moduleMap);
      setCadences([]);
    } catch (error) {
      console.error('Failed to fetch cadences:', error);
    } finally {
      setLoading(false);
    }
  }

  function getStepIcons(steps: CadenceStep[]) {
    return steps.slice(0, 5).map((step, i) => {
      const icons: Record<string, React.ReactNode> = {
        task: <CheckSquare key={i} className="w-4 h-4 text-blue-500" />,
        email: <Mail key={i} className="w-4 h-4 text-emerald-500" />,
        call: <Phone key={i} className="w-4 h-4 text-amber-500" />,
        wait: <Timer key={i} className="w-4 h-4 text-slate-400" />,
      };
      return icons[step.type] || null;
    });
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
              <Timer className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Cadences</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Multi-step engagement sequences
              </p>
            </div>
          </div>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Create Cadence
        </Button>
      </div>

      {/* Step Types */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <CheckSquare className="w-5 h-5 text-blue-500" />
            <span className="font-medium text-slate-900 dark:text-white">Task</span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Create a follow-up task
          </p>
        </div>
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <Mail className="w-5 h-5 text-emerald-500" />
            <span className="font-medium text-slate-900 dark:text-white">Email</span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Send an email (coming soon)
          </p>
        </div>
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <Phone className="w-5 h-5 text-amber-500" />
            <span className="font-medium text-slate-900 dark:text-white">Call</span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Create a call task
          </p>
        </div>
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <Timer className="w-5 h-5 text-slate-500" />
            <span className="font-medium text-slate-900 dark:text-white">Wait</span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Wait N days before next step
          </p>
        </div>
      </div>

      {/* Cadences Table */}
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : cadences.length === 0 ? (
          <div className="text-center py-12">
            <Timer className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
              No cadences yet
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              Create cadences for automated follow-up sequences
            </p>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Cadence
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Steps</TableHead>
                <TableHead>Enrollments</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cadences.map((cadence) => (
                <TableRow key={cadence.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">
                        {cadence.name}
                      </div>
                      {cadence.description && (
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          {cadence.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {modules[cadence.module_id] || 'Unknown'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {getStepIcons(cadence.steps)}
                      {cadence.steps.length > 5 && (
                        <span className="text-sm text-slate-400">+{cadence.steps.length - 5}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-slate-600 dark:text-slate-400">0 active</span>
                  </TableCell>
                  <TableCell>
                    <Switch checked={cadence.is_enabled} />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600">
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
    </div>
  );
}
