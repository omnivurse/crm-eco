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
  Clock,
  Plus,
  ArrowLeft,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import type { CrmSlaPolicy } from '@/lib/automation/types';

export default function SLAPoliciesPage() {
  const [policies, setPolicies] = useState<CrmSlaPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchPolicies();
  }, []);

  async function fetchPolicies() {
    try {
      const res = await fetch('/api/crm/modules');
      const modulesData = await res.json();
      const moduleMap: Record<string, string> = {};
      modulesData.forEach((m: { id: string; name: string }) => {
        moduleMap[m.id] = m.name;
      });
      setModules(moduleMap);
      setPolicies([]);
    } catch (error) {
      console.error('Failed to fetch policies:', error);
    } finally {
      setLoading(false);
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
            <div className="p-2 bg-rose-500/10 rounded-lg">
              <Clock className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">SLA Policies</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Set response times and escalation rules
              </p>
            </div>
          </div>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Create Policy
        </Button>
      </div>

      {/* SLA Overview */}
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          How SLA Policies Work
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-green-500" />
              <span className="font-medium text-green-700 dark:text-green-300">Response Time</span>
            </div>
            <p className="text-sm text-green-600 dark:text-green-400">
              Define target response times for new records
            </p>
          </div>
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <span className="font-medium text-amber-700 dark:text-amber-300">Escalation</span>
            </div>
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Escalate to managers when SLA is at risk
            </p>
          </div>
          <div className="p-4 bg-rose-50 dark:bg-rose-900/20 rounded-lg border border-rose-200 dark:border-rose-800">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-rose-500" />
              <span className="font-medium text-rose-700 dark:text-rose-300">Breach</span>
            </div>
            <p className="text-sm text-rose-600 dark:text-rose-400">
              Track and report on SLA breaches
            </p>
          </div>
        </div>
      </div>

      {/* Policies Table */}
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : policies.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
              No SLA policies yet
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              Create policies to track response times and escalations
            </p>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Policy
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Response Time</TableHead>
                <TableHead>Escalations</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policies.map((policy) => (
                <TableRow key={policy.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">
                        {policy.name}
                      </div>
                      {policy.description && (
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          {policy.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {modules[policy.module_id] || 'Unknown'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {policy.config.responseHours}h
                  </TableCell>
                  <TableCell>
                    {policy.config.escalations?.length || 0} level{policy.config.escalations?.length !== 1 ? 's' : ''}
                  </TableCell>
                  <TableCell>
                    <Switch checked={policy.is_enabled} />
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
