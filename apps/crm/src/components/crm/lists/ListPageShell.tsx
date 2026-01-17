'use client';

import { ReactNode } from 'react';
import { ModuleHeader, ModuleHeaderProps } from './ModuleHeader';
import { MassActionsBar, MassActionsBarProps } from './MassActionsBar';
import { EmptyState } from './EmptyState';

export interface ListPageShellProps {
    // Header props
    moduleName: string;
    moduleNamePlural?: string;
    recordCount?: number;

    // View and filter handlers
    currentView?: string;
    onViewChange?: (viewKey: string) => void;
    onSearch?: (query: string) => void;
    onCreateClick?: () => void;
    onFilterClick?: () => void;
    onColumnsClick?: () => void;
    onExportClick?: () => void;
    createLabel?: string;

    // Selection props
    selectedIds?: string[];
    onSelectAll?: () => void;
    onClearSelection?: () => void;
    showStageAction?: boolean;

    // Mass action handlers
    onAssignOwner?: () => void;
    onChangeStatus?: () => void;
    onAddTag?: () => void;
    onDelete?: () => void;
    onMoveStage?: () => void;

    // Empty state
    emptyStateTitle?: string;
    emptyStateDescription?: string;
    emptyStateActionLabel?: string;
    emptyStateActionHref?: string;

    // Content
    children: ReactNode;
    isEmpty?: boolean;
}

export function ListPageShell({
    moduleName,
    moduleNamePlural,
    recordCount = 0,
    currentView,
    onViewChange,
    onSearch,
    onCreateClick,
    onFilterClick,
    onColumnsClick,
    onExportClick,
    createLabel,
    selectedIds = [],
    onSelectAll,
    onClearSelection,
    showStageAction,
    onAssignOwner,
    onChangeStatus,
    onAddTag,
    onDelete,
    onMoveStage,
    emptyStateTitle,
    emptyStateDescription,
    emptyStateActionLabel,
    emptyStateActionHref,
    children,
    isEmpty,
}: ListPageShellProps) {
    const showEmptyState = isEmpty || recordCount === 0;
    const selectedCount = selectedIds.length;

    return (
        <div className="space-y-4">
            {/* Module Header */}
            <ModuleHeader
                moduleName={moduleName}
                moduleNamePlural={moduleNamePlural}
                recordCount={recordCount}
                currentView={currentView}
                onViewChange={onViewChange}
                onSearch={onSearch}
                onCreateClick={onCreateClick}
                onFilterClick={onFilterClick}
                onColumnsClick={onColumnsClick}
                onExportClick={onExportClick}
                createLabel={createLabel}
            />

            {/* Mass Actions Bar */}
            {selectedCount > 0 && (
                <MassActionsBar
                    selectedCount={selectedCount}
                    totalCount={recordCount}
                    onSelectAll={onSelectAll}
                    onClearSelection={onClearSelection}
                    onAssignOwner={onAssignOwner}
                    onChangeStatus={onChangeStatus}
                    onAddTag={onAddTag}
                    onDelete={onDelete}
                    onExport={onExportClick}
                    onMoveStage={onMoveStage}
                    showStageAction={showStageAction}
                />
            )}

            {/* Content or Empty State */}
            {showEmptyState ? (
                <EmptyState
                    title={emptyStateTitle || `No ${moduleNamePlural || moduleName + 's'} yet`}
                    description={emptyStateDescription || `Get started by creating your first ${moduleName.toLowerCase()}.`}
                    actionLabel={emptyStateActionLabel || `Create ${moduleName}`}
                    actionHref={emptyStateActionHref}
                    onAction={onCreateClick}
                />
            ) : (
                children
            )}
        </div>
    );
}

// Export all list components for convenience
export { ModuleHeader } from './ModuleHeader';
export { MassActionsBar } from './MassActionsBar';
export { EmptyState } from './EmptyState';
