'use client';

import { useState } from 'react';
import { Button } from '@crm-eco/ui/components/button';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  X,
  UserPlus,
  Tag,
  Trash2,
  Download,
  ChevronDown,
  ArrowRightLeft,
  Mail,
  MoreHorizontal,
  CheckCircle,
} from 'lucide-react';

interface MassActionsBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll?: () => void;
  onClearSelection: () => void;
  onAssignOwner: () => void;
  onChangeStatus: () => void;
  onChangeStage?: () => void;
  onAddTag?: () => void;
  onSendEmail?: () => void;
  onDelete: () => void;
  onExport: () => void;
  moduleKey?: string;
  className?: string;
}

export function MassActionsBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onAssignOwner,
  onChangeStatus,
  onChangeStage,
  onAddTag,
  onSendEmail,
  onDelete,
  onExport,
  moduleKey,
  className,
}: MassActionsBarProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (selectedCount === 0) return null;

  const showStageAction = moduleKey === 'deals';
  const allSelected = selectedCount === totalCount;

  return (
    <>
      {/* Mobile: Full-width bottom bar */}
      <div
        className={cn(
          'fixed z-50',
          // Mobile: full width at bottom with safe area padding
          'bottom-0 left-0 right-0 md:bottom-6 md:left-1/2 md:right-auto md:-translate-x-1/2',
          // Layout
          'flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-3',
          'px-4 py-3 md:rounded-2xl rounded-t-2xl',
          'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10',
          'shadow-xl shadow-slate-900/10 dark:shadow-black/30',
          // Safe area for notched devices
          'pb-[max(0.75rem,env(safe-area-inset-bottom))]',
          className
        )}
      >
        {/* Top Row: Selection Count & Close */}
        <div className="flex items-center justify-between md:contents">
          <div className="flex items-center gap-2 md:pr-3 md:border-r border-slate-200 dark:border-white/10">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-500/20">
              <CheckCircle className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                {selectedCount} selected
              </span>
              {!allSelected && onSelectAll && (
                <button
                  onClick={onSelectAll}
                  className="text-xs text-teal-600 dark:text-teal-400 hover:underline text-left"
                >
                  Select all {totalCount}
                </button>
              )}
            </div>
          </div>

          {/* Mobile Close Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClearSelection}
            className="md:hidden h-8 w-8 text-slate-500 hover:text-slate-900 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Actions Row - scrollable on mobile */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 -mx-1 px-1 scrollbar-none">
          <Button
            variant="ghost"
            size="sm"
            onClick={onAssignOwner}
            className="h-9 px-3 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 flex-shrink-0"
          >
            <UserPlus className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline">Assign</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onChangeStatus}
            className="h-9 px-3 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 flex-shrink-0"
          >
            <Tag className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline">Status</span>
          </Button>

          {showStageAction && onChangeStage && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onChangeStage}
              className="h-9 px-3 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 flex-shrink-0"
            >
              <ArrowRightLeft className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Stage</span>
            </Button>
          )}

          {onSendEmail && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSendEmail}
              className="h-9 px-3 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 flex-shrink-0"
            >
              <Mail className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Email</span>
            </Button>
          )}

          {/* More Actions Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-2 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 flex-shrink-0"
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              side="top"
              className="w-44 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10"
            >
              {onAddTag && (
                <DropdownMenuItem
                  onClick={onAddTag}
                  className="cursor-pointer text-slate-700 dark:text-slate-300"
                >
                  <Tag className="w-4 h-4 mr-2" />
                  Add Tag
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={onExport}
                className="cursor-pointer text-slate-700 dark:text-slate-300"
              >
                <Download className="w-4 h-4 mr-2" />
                Export Selected
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-200 dark:bg-white/10" />
              <DropdownMenuItem
                onClick={() => setShowDeleteConfirm(true)}
                className="cursor-pointer text-red-600 dark:text-red-400 focus:text-red-700 focus:bg-red-50 dark:focus:bg-red-500/10"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Selected
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Desktop Divider & Close */}
        <div className="hidden md:block w-px h-8 bg-slate-200 dark:bg-white/10" />
        <Button
          variant="ghost"
          size="icon"
          onClick={onClearSelection}
          className="hidden md:flex h-8 w-8 text-slate-500 hover:text-slate-900 dark:hover:text-white"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900 dark:text-white">
              Delete {selectedCount} records?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500">
              This action cannot be undone. This will permanently delete the selected
              records and remove all associated data including notes, tasks, and attachments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDelete();
                setShowDeleteConfirm(false);
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete Records
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
