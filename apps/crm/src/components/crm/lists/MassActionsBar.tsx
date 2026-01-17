'use client';

import { useState } from 'react';
import { cn } from '@crm-eco/ui/lib/utils';
import { Button } from '@crm-eco/ui/components/button';
import { Checkbox } from '@crm-eco/ui/components/checkbox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import {
    ChevronDown,
    UserPlus,
    Tags,
    Trash2,
    Download,
    ArrowRight,
    X,
} from 'lucide-react';

export interface MassActionsBarProps {
    selectedCount: number;
    totalCount: number;
    onSelectAll?: () => void;
    onClearSelection?: () => void;
    onAssignOwner?: () => void;
    onChangeStatus?: () => void;
    onAddTag?: () => void;
    onDelete?: () => void;
    onExport?: () => void;
    onMoveStage?: () => void;
    showStageAction?: boolean;
}

export function MassActionsBar({
    selectedCount,
    totalCount,
    onSelectAll,
    onClearSelection,
    onAssignOwner,
    onChangeStatus,
    onAddTag,
    onDelete,
    onExport,
    onMoveStage,
    showStageAction = false,
}: MassActionsBarProps) {
    if (selectedCount === 0) return null;

    return (
        <div className="sticky top-0 z-20 bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-800 rounded-lg p-3 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <Checkbox
                        checked={selectedCount === totalCount}
                        onCheckedChange={() => {
                            if (selectedCount === totalCount) {
                                onClearSelection?.();
                            } else {
                                onSelectAll?.();
                            }
                        }}
                        className="border-teal-400 data-[state=checked]:bg-teal-500"
                    />
                    <span className="text-sm font-medium text-teal-700 dark:text-teal-300">
                        {selectedCount} of {totalCount} selected
                    </span>
                </div>

                {selectedCount < totalCount && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onSelectAll}
                        className="text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 h-7 px-2"
                    >
                        Select all {totalCount}
                    </Button>
                )}
            </div>

            <div className="flex items-center gap-2">
                {/* Assign Owner */}
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onAssignOwner}
                    className="h-8 gap-2 border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/50"
                >
                    <UserPlus className="w-4 h-4" />
                    <span className="hidden sm:inline">Assign Owner</span>
                </Button>

                {/* Change Status/Stage */}
                {showStageAction ? (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onMoveStage}
                        className="h-8 gap-2 border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/50"
                    >
                        <ArrowRight className="w-4 h-4" />
                        <span className="hidden sm:inline">Move Stage</span>
                    </Button>
                ) : (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onChangeStatus}
                        className="h-8 gap-2 border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/50"
                    >
                        <ChevronDown className="w-4 h-4" />
                        <span className="hidden sm:inline">Change Status</span>
                    </Button>
                )}

                {/* Add Tag */}
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onAddTag}
                    className="h-8 gap-2 border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/50"
                >
                    <Tags className="w-4 h-4" />
                    <span className="hidden sm:inline">Add Tag</span>
                </Button>

                {/* Export */}
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onExport}
                    className="h-8 gap-2 border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/50"
                >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Export</span>
                </Button>

                {/* Delete */}
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onDelete}
                    className="h-8 gap-2 border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
                >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Delete</span>
                </Button>

                {/* Clear Selection */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClearSelection}
                    className="h-8 w-8 text-teal-600 dark:text-teal-400 hover:text-teal-700"
                >
                    <X className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
}
