'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@crm-eco/ui/components/button';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  Plus,
  Upload,
  Download,
  MoreHorizontal,
  ChevronRight,
  Users,
  UserPlus,
  DollarSign,
  Building2,
  CheckSquare,
  Settings,
  LayoutGrid,
  Pencil,
  Trash2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import type { CrmModule } from '@/lib/crm/types';

interface ModuleHeaderProps {
  module: CrmModule;
  totalCount: number;
  onExport?: () => void;
  onBulkUpdate?: () => void;
  onMassDelete?: () => void;
  selectedCount?: number;
  className?: string;
}

const MODULE_ICONS: Record<string, React.ReactNode> = {
  contacts: <Users className="w-5 h-5" />,
  leads: <UserPlus className="w-5 h-5" />,
  deals: <DollarSign className="w-5 h-5" />,
  accounts: <Building2 className="w-5 h-5" />,
  tasks: <CheckSquare className="w-5 h-5" />,
};

const MODULE_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  contacts: { text: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/30' },
  leads: { text: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/30' },
  deals: { text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  accounts: { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  tasks: { text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
};

export function ModuleHeader({
  module,
  totalCount,
  onExport,
  onBulkUpdate,
  onMassDelete,
  selectedCount = 0,
  className
}: ModuleHeaderProps) {
  const router = useRouter();
  const icon = MODULE_ICONS[module.key] || <Users className="w-5 h-5" />;
  const colors = MODULE_COLORS[module.key] || MODULE_COLORS.contacts;

  const handleManageFields = () => {
    router.push(`/crm/settings/fields?module=${module.id}`);
  };

  const handleManageViews = () => {
    router.push(`/crm/settings/layouts?module=${module.id}`);
  };

  const handleBulkUpdate = () => {
    if (onBulkUpdate) {
      onBulkUpdate();
    } else {
      router.push(`/crm/modules/${module.key}/bulk-update`);
    }
  };

  const handleMassDelete = () => {
    if (onMassDelete) {
      onMassDelete();
    } else {
      router.push(`/crm/modules/${module.key}/mass-delete`);
    }
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link
          href="/crm"
          className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        >
          CRM
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600" />
        <span className="font-medium text-slate-900 dark:text-white">
          {module.name_plural || module.name}
        </span>
      </nav>

      {/* Title Row */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={cn('p-2.5 rounded-xl', colors.bg, colors.text)}>
            {icon}
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              {module.name_plural || module.name}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {totalCount.toLocaleString()} {totalCount === 1 ? 'record' : 'records'}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5"
            asChild
          >
            <Link href={`/crm/import?module=${module.key}`}>
              <Upload className="w-4 h-4 mr-1.5" />
              Import
            </Link>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-9 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5"
            onClick={onExport}
          >
            <Download className="w-4 h-4 mr-1.5" />
            Export
          </Button>

          <Button
            size="sm"
            className="h-9 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white shadow-sm"
            asChild
          >
            <Link href={`/crm/modules/${module.key}/new`}>
              <Plus className="w-4 h-4 mr-1.5" />
              New {module.name}
            </Link>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
              <DropdownMenuItem
                onClick={handleManageFields}
                className="text-slate-700 dark:text-slate-300 cursor-pointer gap-2"
              >
                <Settings className="w-4 h-4" />
                Manage Fields
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleManageViews}
                className="text-slate-700 dark:text-slate-300 cursor-pointer gap-2"
              >
                <LayoutGrid className="w-4 h-4" />
                Manage Views
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-200 dark:bg-white/10" />
              <DropdownMenuItem
                onClick={handleBulkUpdate}
                className="text-slate-700 dark:text-slate-300 cursor-pointer gap-2"
              >
                <Pencil className="w-4 h-4" />
                Bulk Update
                {selectedCount > 0 && (
                  <span className="ml-auto text-xs bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 px-1.5 py-0.5 rounded">
                    {selectedCount}
                  </span>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleMassDelete}
                className="text-red-600 dark:text-red-400 cursor-pointer gap-2 focus:text-red-600 dark:focus:text-red-400"
              >
                <Trash2 className="w-4 h-4" />
                Mass Delete
                {selectedCount > 0 && (
                  <span className="ml-auto text-xs bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded">
                    {selectedCount}
                  </span>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
