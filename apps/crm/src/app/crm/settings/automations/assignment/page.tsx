'use client';

import { useState, useEffect } from 'react';
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
  UserCheck,
  Plus,
  ArrowLeft,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  Users,
  MapPin,
  Scale,
  User,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import type { CrmAssignmentRule } from '@/lib/automation/types';

export default function AssignmentRulesPage() {
  const router = useRouter();
  const [rules, setRules] = useState<CrmAssignmentRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchRules();
  }, []);

  async function fetchRules() {
    try {
      const res = await fetch('/api/crm/modules');
      const modulesData = await res.json();
      const moduleMap: Record<string, string> = {};
      modulesData.forEach((m: { id: string; name: string }) => {
        moduleMap[m.id] = m.name;
      });
      setModules(moduleMap);
      setRules([]);
    } catch (error) {
      console.error('Failed to fetch rules:', error);
    } finally {
      setLoading(false);
    }
  }

  const strategyIcons: Record<string, React.ReactNode> = {
    round_robin: <Users className="w-4 h-4" />,
    territory: <MapPin className="w-4 h-4" />,
    least_loaded: <Scale className="w-4 h-4" />,
    fixed: <User className="w-4 h-4" />,
  };

  const strategyLabels: Record<string, string> = {
    round_robin: 'Round Robin',
    territory: 'Territory',
    least_loaded: 'Least Loaded',
    fixed: 'Fixed Owner',
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
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <UserCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Assignment Rules</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Automatically assign record owners
              </p>
            </div>
          </div>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Create Rule
        </Button>
      </div>

      {/* Strategy Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-5 h-5 text-blue-500" />
            <span className="font-medium text-slate-900 dark:text-white">Round Robin</span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Distribute evenly among team members
          </p>
        </div>
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <MapPin className="w-5 h-5 text-emerald-500" />
            <span className="font-medium text-slate-900 dark:text-white">Territory</span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Assign based on location or region
          </p>
        </div>
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <Scale className="w-5 h-5 text-amber-500" />
            <span className="font-medium text-slate-900 dark:text-white">Least Loaded</span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Assign to user with fewest open records
          </p>
        </div>
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <User className="w-5 h-5 text-purple-500" />
            <span className="font-medium text-slate-900 dark:text-white">Fixed Owner</span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Always assign to a specific user
          </p>
        </div>
      </div>

      {/* Rules Table */}
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-12">
            <UserCheck className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
              No assignment rules yet
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              Create rules to automatically assign owners to records
            </p>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Rule
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Strategy</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium text-slate-900 dark:text-white">
                    {rule.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {modules[rule.module_id] || 'Unknown'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {strategyIcons[rule.strategy]}
                      <span>{strategyLabels[rule.strategy]}</span>
                    </div>
                  </TableCell>
                  <TableCell>{rule.priority}</TableCell>
                  <TableCell>
                    <Switch checked={rule.is_enabled} />
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
