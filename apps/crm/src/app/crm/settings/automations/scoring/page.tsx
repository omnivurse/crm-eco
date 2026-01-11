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
  Star,
  Plus,
  ArrowLeft,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import type { CrmScoringRules } from '@/lib/automation/types';

export default function ScoringRulesPage() {
  const [scoringRules, setScoringRules] = useState<CrmScoringRules[]>([]);
  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchScoringRules();
  }, []);

  async function fetchScoringRules() {
    try {
      const res = await fetch('/api/crm/modules');
      const modulesData = await res.json();
      const moduleMap: Record<string, string> = {};
      modulesData.forEach((m: { id: string; name: string }) => {
        moduleMap[m.id] = m.name;
      });
      setModules(moduleMap);
      setScoringRules([]);
    } catch (error) {
      console.error('Failed to fetch scoring rules:', error);
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
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <Star className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Scoring Rules</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Score records based on field values
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Recalculate All
          </Button>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Create Scoring Rules
          </Button>
        </div>
      </div>

      {/* Example Scoring Logic */}
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          How Scoring Works
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-5 h-5 text-amber-500" />
              <span className="font-medium text-slate-900 dark:text-white">+10 points</span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Status is "Hot Lead"
            </p>
          </div>
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-5 h-5 text-amber-500" />
              <span className="font-medium text-slate-900 dark:text-white">+5 points</span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Has email address
            </p>
          </div>
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-5 h-5 text-amber-500" />
              <span className="font-medium text-slate-900 dark:text-white">+15 points</span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Budget over $10,000
            </p>
          </div>
        </div>
      </div>

      {/* Scoring Rules Table */}
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : scoringRules.length === 0 ? (
          <div className="text-center py-12">
            <Star className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
              No scoring rules yet
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              Create rules to score your leads and records
            </p>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Scoring Rules
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Rules</TableHead>
                <TableHead>Score Field</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scoringRules.map((scoring) => (
                <TableRow key={scoring.id}>
                  <TableCell className="font-medium text-slate-900 dark:text-white">
                    {scoring.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {modules[scoring.module_id] || 'Unknown'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {scoring.rules.length} rule{scoring.rules.length !== 1 ? 's' : ''}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {scoring.score_field_key}
                  </TableCell>
                  <TableCell>
                    <Switch checked={scoring.is_enabled} />
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
