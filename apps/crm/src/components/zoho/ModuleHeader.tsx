'use client';

import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@crm-eco/ui/components/button';
import { IdentityActionsHeader } from '@crm-eco/ui/components/identity-actions-header';
import { cn } from '@crm-eco/ui/lib/utils';
import { resolveModulePalette } from '@/components/crm/records/v2/tokens';
import {
  Plus,
  Upload,
  Download,
  MoreHorizontal,
  Users,
  UserPlus,
  UserCheck,
  DollarSign,
  Building2,
  CheckSquare,
  Settings,
  LayoutGrid,
  Pencil,
  RefreshCw,
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
import { resolveCreateIntent } from '@/lib/crm/create-intent';

// Contacts/Leads "New …" opens the one-screen quick drawer (with an
// "Open full form" handoff inside) instead of the 250-field full form.
const QuickCreateDrawer = dynamic(
  () => import('@/components/zoho/QuickCreateDrawer').then((mod) => mod.QuickCreateDrawer),
  { ssr: false },
);
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
  const searchParams = useSearchParams();
  const icon = MODULE_ICONS[module.key] || <Users className="w-5 h-5" />;
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const createIntent = resolveCreateIntent({ moduleKey: module.key });
  const usesQuickCreate = createIntent.kind === 'quick';
  const quickModuleKey = createIntent.kind === 'quick' ? createIntent.moduleKey : null;
  const newLabel =
    module.key === 'contacts' || module.key === 'members'
      ? 'Add Member'
      : `New ${module.name}`;
  const colors = resolveModulePalette(module.key);

  // Check if tree view is currently active
  const currentViewMode = searchParams.get('viewMode');
  const currentTreeGroupBy = searchParams.get('treeGroupBy');
  const isAdvisorTree = currentViewMode === 'tree' && currentTreeGroupBy === 'advisor';

  // Toggle tree view mode for "By Advisor" / "By Agent" buttons
  const handleTreeToggle = (groupBy: 'advisor' | 'agent') => {
    const params = new URLSearchParams(searchParams.toString());
    const alreadyActive =
      currentViewMode === 'tree' && currentTreeGroupBy === groupBy;

    if (alreadyActive) {
      // Toggle off: return to default table view
      params.delete('viewMode');
      params.delete('treeGroupBy');
    } else {
      params.set('viewMode', 'tree');
      params.set('treeGroupBy', groupBy);
      // Clean up sort/filter params from the old quick-sort behaviour
      params.delete('sortField');
      params.delete('sortDirection');
      params.delete('filters');
    }
    params.delete('page');
    router.push(`/crm/modules/${module.key}?${params.toString()}`);
  };

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
    <div className={cn('flex flex-col', className)}>
      <IdentityActionsHeader
        breakpoint="lg"
        align="center"
        leading={
          <div className={cn('p-2 rounded-xl', colors.bg, colors.text)}>{icon}</div>
        }
        identity={
          <div className="flex items-baseline gap-2.5 min-w-0 flex-wrap">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white truncate">
              {module.name_plural || module.name}
            </h1>
            <span className="text-sm text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
              {totalCount.toLocaleString()} {totalCount === 1 ? 'record' : 'records'}
            </span>
          </div>
        }
        actions={
          <>
            {(module.key === 'contacts' || module.key === 'leads') && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTreeToggle('advisor')}
                  title="Group records by assigned Advisor"
                  className={cn(
                    'h-9',
                    isAdvisorTree
                      ? 'border-teal-300 bg-teal-50 text-teal-700 dark:border-teal-700 dark:bg-teal-950/50 dark:text-teal-300'
                      : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5',
                  )}
                >
                  <UserCheck className="w-4 h-4 mr-1.5" />
                  By Advisor
                </Button>
                <div className="w-px h-6 bg-slate-200 dark:bg-white/10" />
              </>
            )}

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

            {usesQuickCreate ? (
              <Button
                size="sm"
                className="h-9 shadow-sm"
                onClick={() => setQuickCreateOpen(true)}
                title={`${newLabel} — quick create (full form available inside)`}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                {newLabel}
              </Button>
            ) : (
              <Button size="sm" className="h-9 shadow-sm" asChild>
                <Link
                  href={`/crm/modules/${module.key}/new`}
                  title={
                    module.key === 'members'
                      ? 'Opens the full Member record form (members are normally created by enrollment)'
                      : `${newLabel} — full form`
                  }
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  {newLabel}
                </Link>
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  aria-label="More actions"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10"
              >
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
                <DropdownMenuItem asChild className="cursor-pointer gap-2">
                  <Link
                    href={`/crm/imports/update?module=${module.key}`}
                    prefetch={false}
                    className="flex items-center gap-2 w-full text-slate-700 dark:text-slate-300"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Update from CSV
                  </Link>
                </DropdownMenuItem>
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
                {module.key === 'members' && (
                  <DropdownMenuItem asChild className="cursor-pointer gap-2">
                    <Link href="/crm/modules/members/new">
                      <Plus className="w-4 h-4" />
                      New Member record
                    </Link>
                  </DropdownMenuItem>
                )}
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
          </>
        }
      />
      {usesQuickCreate && quickModuleKey && (
        <QuickCreateDrawer
          open={quickCreateOpen}
          onOpenChange={setQuickCreateOpen}
          defaultModule={quickModuleKey}
        />
      )}
    </div>
  );
}
