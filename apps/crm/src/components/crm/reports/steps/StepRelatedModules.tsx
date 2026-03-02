'use client';

import { Button } from '@crm-eco/ui/components/button';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  Plus,
  X,
  ArrowRight,
  Users,
  UserPlus,
  DollarSign,
  Building2,
  CheckSquare,
  Database,
  Link2,
} from 'lucide-react';
import type { ModuleOption } from '../useReportBuilder';
import type { RelatedModuleConfig, JoinType } from '@/lib/reports/types';

const MODULE_ICONS: Record<string, React.ReactNode> = {
  contacts: <Users className="w-4 h-4" />,
  leads: <UserPlus className="w-4 h-4" />,
  deals: <DollarSign className="w-4 h-4" />,
  accounts: <Building2 className="w-4 h-4" />,
  tasks: <CheckSquare className="w-4 h-4" />,
};

interface StepRelatedModulesProps {
  modules: ModuleOption[];
  primaryModuleId: string;
  primaryModuleKey: string;
  relatedModules: RelatedModuleConfig[];
  onAddRelated: (mod: ModuleOption, joinType: JoinType) => void;
  onRemoveRelated: (moduleId: string) => void;
  onUpdateJoin: (moduleId: string, joinType: JoinType) => void;
}

export function StepRelatedModules({
  modules,
  primaryModuleId,
  primaryModuleKey,
  relatedModules,
  onAddRelated,
  onRemoveRelated,
  onUpdateJoin,
}: StepRelatedModulesProps) {
  const primaryModule = modules.find(m => m.id === primaryModuleId);

  // Modules available to add (exclude primary and already-added)
  const addedIds = new Set([primaryModuleId, ...relatedModules.map(rm => rm.module_id)]);
  const availableModules = modules.filter(m => !addedIds.has(m.id));

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
          Related Modules
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Add child or parent modules to include data from related records.
          This step is optional — skip if you only need data from the primary module.
        </p>
      </div>

      {/* Visual relationship tree */}
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-5">
        {/* Primary module node */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-teal-100 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400">
            {MODULE_ICONS[primaryModuleKey] || <Database className="w-4 h-4" />}
          </div>
          <div>
            <p className="font-semibold text-sm text-slate-900 dark:text-white">
              {primaryModule?.name || 'Primary Module'}
            </p>
            <p className="text-xs text-teal-600 dark:text-teal-400">Primary</p>
          </div>
        </div>

        {/* Related module nodes */}
        {relatedModules.length > 0 && (
          <div className="ml-6 border-l-2 border-slate-300 dark:border-slate-600 pl-4 space-y-3">
            {relatedModules.map((rm) => (
              <div
                key={rm.module_id}
                className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-3"
              >
                <div className="flex items-center gap-3">
                  <Link2 className="w-3.5 h-3.5 text-slate-400" />
                  <div className="p-1.5 rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400">
                    {MODULE_ICONS[rm.module_key] || <Database className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="font-medium text-sm text-slate-900 dark:text-white">
                      {rm.module_name}
                    </p>
                    <p className="text-xs text-slate-500">{rm.relationship}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Join type toggle */}
                  <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => onUpdateJoin(rm.module_id, 'inclusive')}
                      className={cn(
                        'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                        rm.join_type === 'inclusive'
                          ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-400 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                      )}
                    >
                      Inclusive
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateJoin(rm.module_id, 'exclusive')}
                      className={cn(
                        'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                        rm.join_type === 'exclusive'
                          ? 'bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-400 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                      )}
                    >
                      Exclusive
                    </button>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-500 hover:text-red-600"
                    onClick={() => onRemoveRelated(rm.module_id)}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {relatedModules.length === 0 && (
          <div className="ml-6 border-l-2 border-dashed border-slate-300 dark:border-slate-600 pl-4 py-3">
            <p className="text-sm text-slate-400 italic">
              No related modules added yet
            </p>
          </div>
        )}
      </div>

      {/* Inclusive vs Exclusive explanation */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-950/20">
          <p className="text-xs font-semibold text-teal-700 dark:text-teal-400 mb-1">
            Inclusive (LEFT JOIN)
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Show all primary records, even those without matching related records.
          </p>
        </div>
        <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">
            Exclusive (INNER JOIN)
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Only show primary records that have matching related records.
          </p>
        </div>
      </div>

      {/* Add module buttons */}
      {availableModules.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Add Related Module
          </p>
          <div className="flex flex-wrap gap-2">
            {availableModules.map((mod) => (
              <Button
                key={mod.id}
                variant="outline"
                size="sm"
                onClick={() => onAddRelated(mod, 'inclusive')}
                className="gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                {MODULE_ICONS[mod.key] || <Database className="w-3.5 h-3.5" />}
                {mod.name}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
