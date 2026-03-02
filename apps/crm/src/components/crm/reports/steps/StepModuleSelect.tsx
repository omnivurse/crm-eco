'use client';

import { useState } from 'react';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { Textarea } from '@crm-eco/ui/components/textarea';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  Search,
  Users,
  UserPlus,
  DollarSign,
  Building2,
  CheckSquare,
  FileText,
  Database,
  ClipboardList,
  Coins,
} from 'lucide-react';
import { REPORT_TYPES, type ModuleOption } from '../useReportBuilder';
import type { ReportType } from '@/lib/reports/types';

const MODULE_ICONS: Record<string, React.ReactNode> = {
  contacts: <Users className="w-5 h-5" />,
  leads: <UserPlus className="w-5 h-5" />,
  deals: <DollarSign className="w-5 h-5" />,
  accounts: <Building2 className="w-5 h-5" />,
  tasks: <CheckSquare className="w-5 h-5" />,
};

const LEGACY_SOURCES = [
  { key: 'members', label: 'Members', icon: <Users className="w-5 h-5" /> },
  { key: 'advisors', label: 'Advisors', icon: <ClipboardList className="w-5 h-5" /> },
  { key: 'enrollments', label: 'Enrollments', icon: <FileText className="w-5 h-5" /> },
  { key: 'commissions', label: 'Commissions', icon: <Coins className="w-5 h-5" /> },
];

interface StepModuleSelectProps {
  modules: ModuleOption[];
  primaryModuleId: string;
  dataSource: string;
  reportType: ReportType;
  reportName: string;
  reportDescription: string;
  onModuleChange: (id: string) => void;
  onDataSourceChange: (ds: string) => void;
  onReportTypeChange: (type: ReportType) => void;
  onNameChange: (name: string) => void;
  onDescriptionChange: (desc: string) => void;
}

export function StepModuleSelect({
  modules,
  primaryModuleId,
  dataSource,
  reportType,
  reportName,
  reportDescription,
  onModuleChange,
  onDataSourceChange,
  onReportTypeChange,
  onNameChange,
  onDescriptionChange,
}: StepModuleSelectProps) {
  const [search, setSearch] = useState('');

  const filteredModules = modules.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.key.toLowerCase().includes(search.toLowerCase())
  );

  const filteredLegacy = LEGACY_SOURCES.filter(s =>
    s.label.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectModule = (mod: ModuleOption) => {
    onModuleChange(mod.id);
    onDataSourceChange('');
  };

  const handleSelectLegacy = (key: string) => {
    onDataSourceChange(key);
    onModuleChange('');
  };

  return (
    <div className="space-y-8">
      {/* Report Name & Description */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="report-name">Report Name *</Label>
          <Input
            id="report-name"
            placeholder="e.g., Monthly Sales Summary"
            value={reportName}
            onChange={(e) => onNameChange(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="report-desc">Description</Label>
          <Textarea
            id="report-desc"
            placeholder="Describe what this report shows..."
            value={reportDescription}
            onChange={(e) => onDescriptionChange(e.target.value)}
            rows={1}
            className="min-h-[38px] resize-none"
          />
        </div>
      </div>

      {/* Report Type */}
      <div className="space-y-3">
        <Label>Report Type</Label>
        <div className="grid grid-cols-3 gap-3">
          {REPORT_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => onReportTypeChange(type.value)}
              className={cn(
                'p-4 rounded-xl border text-left transition-all',
                reportType === type.value
                  ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10 ring-1 ring-violet-500/30'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{type.icon}</span>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {type.label}
                </p>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {type.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Primary Module / Data Source */}
      <div className="space-y-3">
        <Label>Primary Module *</Label>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search modules..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* CRM Modules */}
        {filteredModules.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              CRM Modules
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {filteredModules.map((mod) => (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => handleSelectModule(mod)}
                  className={cn(
                    'flex items-center gap-2.5 p-3 rounded-lg border text-left transition-all',
                    primaryModuleId === mod.id
                      ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10 ring-1 ring-teal-500/30'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  )}
                >
                  <div className={cn(
                    'p-1.5 rounded-lg',
                    primaryModuleId === mod.id
                      ? 'bg-teal-100 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                  )}>
                    {MODULE_ICONS[mod.key] || <Database className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="font-medium text-sm text-slate-900 dark:text-white">
                      {mod.name}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Legacy Data Sources */}
        {filteredLegacy.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Legacy Data Sources
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {filteredLegacy.map((src) => (
                <button
                  key={src.key}
                  type="button"
                  onClick={() => handleSelectLegacy(src.key)}
                  className={cn(
                    'flex items-center gap-2.5 p-3 rounded-lg border text-left transition-all',
                    dataSource === src.key
                      ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10 ring-1 ring-teal-500/30'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  )}
                >
                  <div className={cn(
                    'p-1.5 rounded-lg',
                    dataSource === src.key
                      ? 'bg-teal-100 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                  )}>
                    {src.icon}
                  </div>
                  <p className="font-medium text-sm text-slate-900 dark:text-white">
                    {src.label}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
