'use client';

import { useState, useCallback, useMemo } from 'react';
import { cn } from '@crm-eco/ui/lib/utils';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Switch } from '@crm-eco/ui/components/switch';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@crm-eco/ui/components/sheet';
import {
    Columns3,
    Search,
    GripVertical,
    Eye,
    EyeOff,
    Pin,
    RotateCcw,
    ChevronUp,
    ChevronDown,
    Check,
} from 'lucide-react';
import type { CrmField } from '@/lib/crm/types';

// ============================================================================
// Types
// ============================================================================

export interface ColumnConfig {
    key: string;
    visible: boolean;
    pinned: boolean;
    width?: number;
}

export interface ColumnsManagerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    fields: CrmField[];
    columns: ColumnConfig[];
    onApply: (columns: ColumnConfig[]) => void;
    onReset: () => void;
}

// ============================================================================
// Default Column Configurations
// ============================================================================

export function getDefaultColumns(fields: CrmField[]): ColumnConfig[] {
    return fields
        .sort((a, b) => a.display_order - b.display_order)
        .map(field => ({
            key: field.key,
            visible: field.is_pinned || field.is_title_field,
            pinned: field.is_pinned,
        }));
}

// ============================================================================
// Main Component
// ============================================================================

export function ColumnsManager({
    open,
    onOpenChange,
    fields,
    columns: initialColumns,
    onApply,
    onReset,
}: ColumnsManagerProps) {
    const [columns, setColumns] = useState<ColumnConfig[]>(initialColumns);
    const [searchQuery, setSearchQuery] = useState('');

    // Get field by key
    const getField = useCallback((key: string) => {
        return fields.find(f => f.key === key);
    }, [fields]);

    // Filtered columns based on search
    const filteredColumns = useMemo(() => {
        if (!searchQuery) return columns;
        const query = searchQuery.toLowerCase();
        return columns.filter(col => {
            const field = getField(col.key);
            return field?.label.toLowerCase().includes(query) ||
                   field?.key.toLowerCase().includes(query);
        });
    }, [columns, searchQuery, getField]);

    // Visible columns count
    const visibleCount = columns.filter(c => c.visible).length;
    const pinnedCount = columns.filter(c => c.pinned).length;

    // Toggle column visibility
    const toggleVisibility = useCallback((key: string) => {
        setColumns(prev => prev.map(col =>
            col.key === key ? { ...col, visible: !col.visible } : col
        ));
    }, []);

    // Toggle column pinning
    const togglePin = useCallback((key: string) => {
        setColumns(prev => prev.map(col =>
            col.key === key ? { ...col, pinned: !col.pinned, visible: true } : col
        ));
    }, []);

    // Move column up in order
    const moveUp = useCallback((key: string) => {
        setColumns(prev => {
            const index = prev.findIndex(c => c.key === key);
            if (index <= 0) return prev;
            const newColumns = [...prev];
            [newColumns[index - 1], newColumns[index]] = [newColumns[index], newColumns[index - 1]];
            return newColumns;
        });
    }, []);

    // Move column down in order
    const moveDown = useCallback((key: string) => {
        setColumns(prev => {
            const index = prev.findIndex(c => c.key === key);
            if (index < 0 || index >= prev.length - 1) return prev;
            const newColumns = [...prev];
            [newColumns[index], newColumns[index + 1]] = [newColumns[index + 1], newColumns[index]];
            return newColumns;
        });
    }, []);

    // Show all columns
    const showAll = useCallback(() => {
        setColumns(prev => prev.map(col => ({ ...col, visible: true })));
    }, []);

    // Hide all columns (except pinned)
    const hideAll = useCallback(() => {
        setColumns(prev => prev.map(col => ({
            ...col,
            visible: col.pinned, // Keep pinned visible
        })));
    }, []);

    // Reset to default
    const handleReset = useCallback(() => {
        setColumns(getDefaultColumns(fields));
        onReset();
    }, [fields, onReset]);

    // Apply changes
    const handleApply = useCallback(() => {
        onApply(columns);
        onOpenChange(false);
    }, [columns, onApply, onOpenChange]);

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-md bg-white dark:bg-slate-950 overflow-hidden flex flex-col">
                <SheetHeader className="pb-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-violet-100 dark:bg-violet-500/20 rounded-lg">
                            <Columns3 className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div>
                            <SheetTitle className="text-slate-900 dark:text-white">
                                Manage Columns
                            </SheetTitle>
                            <SheetDescription>
                                Choose which columns to display and their order
                            </SheetDescription>
                        </div>
                    </div>
                </SheetHeader>

                {/* Stats & Quick Actions */}
                <div className="py-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-slate-500 dark:text-slate-400">
                                <span className="font-medium text-slate-900 dark:text-white">{visibleCount}</span> visible
                            </span>
                            <span className="text-sm text-slate-500 dark:text-slate-400">
                                <span className="font-medium text-slate-900 dark:text-white">{pinnedCount}</span> pinned
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={showAll}
                                className="h-8 text-xs text-slate-600 dark:text-slate-400"
                            >
                                <Eye className="w-3.5 h-3.5 mr-1" />
                                Show all
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={hideAll}
                                className="h-8 text-xs text-slate-600 dark:text-slate-400"
                            >
                                <EyeOff className="w-3.5 h-3.5 mr-1" />
                                Hide all
                            </Button>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            type="text"
                            placeholder="Search columns..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                        />
                    </div>
                </div>

                {/* Columns List */}
                <div className="flex-1 overflow-y-auto py-2 min-h-0">
                    <div className="space-y-1">
                        {filteredColumns.map((col, index) => {
                            const field = getField(col.key);
                            if (!field) return null;

                            return (
                                <div
                                    key={col.key}
                                    className={cn(
                                        'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors',
                                        col.visible
                                            ? 'bg-slate-50 dark:bg-slate-900/50'
                                            : 'opacity-60'
                                    )}
                                >
                                    {/* Drag Handle */}
                                    <div className="flex flex-col -space-y-0.5">
                                        <button
                                            onClick={() => moveUp(col.key)}
                                            disabled={index === 0}
                                            className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            <ChevronUp className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => moveDown(col.key)}
                                            disabled={index === filteredColumns.length - 1}
                                            className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            <ChevronDown className="w-3.5 h-3.5" />
                                        </button>
                                    </div>

                                    {/* Column Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                                {field.label}
                                            </span>
                                            {field.is_system && (
                                                <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded uppercase font-medium">
                                                    System
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-xs text-slate-500 dark:text-slate-400">
                                            {field.type}
                                        </span>
                                    </div>

                                    {/* Pin Toggle */}
                                    <button
                                        onClick={() => togglePin(col.key)}
                                        className={cn(
                                            'p-1.5 rounded transition-colors',
                                            col.pinned
                                                ? 'text-amber-500 bg-amber-50 dark:bg-amber-500/20'
                                                : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                                        )}
                                        title={col.pinned ? 'Unpin column' : 'Pin column'}
                                    >
                                        <Pin className="w-4 h-4" />
                                    </button>

                                    {/* Visibility Toggle */}
                                    <Switch
                                        checked={col.visible}
                                        onCheckedChange={() => toggleVisibility(col.key)}
                                        className="data-[state=checked]:bg-teal-500"
                                    />
                                </div>
                            );
                        })}
                    </div>

                    {filteredColumns.length === 0 && searchQuery && (
                        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                            No columns match &quot;{searchQuery}&quot;
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
                    <Button
                        variant="ghost"
                        onClick={handleReset}
                        className="text-slate-600 dark:text-slate-400"
                    >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Reset
                    </Button>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleApply}
                            className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400 text-white"
                        >
                            <Check className="w-4 h-4 mr-2" />
                            Apply
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
