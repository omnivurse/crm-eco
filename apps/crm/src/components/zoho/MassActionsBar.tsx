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
      <div
        className={cn(
          'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
          'flex items-center gap-3 px-4 py-3 rounded-2xl',
          'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10',
          'shadow-xl shadow-slate-900/10 dark:shadow-black/30',
          'animate-fade-in-up',
          className
        )}
      >
        {/* Selection Count */}
        <div className="flex items-center gap-2 pr-3 border-r border-slate-200 dark:border-white/10">
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

        {/* Primary Actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onAssignOwner}
            className="h-9 px-3 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
          >
            <UserPlus className="w-4 h-4 mr-1.5" />
            Assign
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onChangeStatus}
            className="h-9 px-3 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
          >
            <Tag className="w-4 h-4 mr-1.5" />
            Status
          </Button>

          {showStageAction && onChangeStage && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onChangeStage}
              className="h-9 px-3 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
            >
              <ArrowRightLeft className="w-4 h-4 mr-1.5" />
              Stage
            </Button>
          )}

          {onSendEmail && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSendEmail}
              className="h-9 px-3 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
            >
              <Mail className="w-4 h-4 mr-1.5" />
              Email
            </Button>
          )}

          {/* More Actions Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-2 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="center"
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

        {/* Divider */}
        <div className="w-px h-8 bg-slate-200 dark:bg-white/10" />

        {/* Close Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onClearSelection}
          className="h-8 w-8 text-slate-500 hover:text-slate-900 dark:hover:text-white"
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
