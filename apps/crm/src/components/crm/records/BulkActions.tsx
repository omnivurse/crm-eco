'use client';

import { useState } from 'react';
import { cn } from '@crm-eco/ui/lib/utils';
import { Button } from '@crm-eco/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@crm-eco/ui/components/dialog';
import { UserPlus, Tag, Trash2, Download, ChevronDown, X } from 'lucide-react';

interface BulkActionsProps {
  selectedCount: number;
  onClearSelection: () => void;
  onAssignOwner: () => void;
  onUpdateStatus: () => void;
  onDelete: () => void;
  onExport: () => void;
}

export function BulkActions({
  selectedCount,
  onClearSelection,
  onAssignOwner,
  onUpdateStatus,
  onDelete,
  onExport,
}: BulkActionsProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (selectedCount === 0) return null;

  return (
    <>
      <div className="flex items-center gap-2 px-4 py-2 bg-teal-50 dark:bg-teal-500/10 border-y border-teal-200 dark:border-teal-500/20 animate-fade-in-up">
        {/* Selection Count */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-teal-700 dark:text-teal-300">
            {selectedCount} selected
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClearSelection}
            className="h-6 w-6 rounded-full text-teal-600 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-500/20"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-teal-200 dark:bg-teal-500/30 mx-2" />

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onAssignOwner}
            className="h-8 px-2.5 text-sm text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-500/20"
          >
            <UserPlus className="w-3.5 h-3.5 mr-1.5" />
            Assign
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onUpdateStatus}
            className="h-8 px-2.5 text-sm text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-500/20"
          >
            <Tag className="w-3.5 h-3.5 mr-1.5" />
            Update Status
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onExport}
            className="h-8 px-2.5 text-sm text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-500/20"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
            className="h-8 px-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            Delete
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900 dark:text-white">
              Delete {selectedCount} records?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500">
              This action cannot be undone. This will permanently delete the selected
              records and remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-200 dark:border-white/10">
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
