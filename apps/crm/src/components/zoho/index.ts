/**
 * Zoho-style CRM UI Components
 * 
 * A collection of components that provide Zoho CRM-like UX patterns
 * while maintaining the Omnial Command Center design language.
 */

// Shell & Layout
export { ModuleShell } from './ModuleShell';
export { ModuleHeader } from './ModuleHeader';
export { ViewsDropdown } from './ViewsDropdown';
export { FilterChipsBar } from './FilterChipsBar';
export { MassActionsBar } from './MassActionsBar';
export { DensityToggle } from './DensityToggle';

// Filters & Columns
export { AdvancedFilterBuilder, type FilterGroup, type FilterRule } from './AdvancedFilterBuilder';
export { ColumnsButton } from './ColumnsButton';
export { QuickFilters } from './QuickFilters';

// Record Drawer
export { RecordDrawer } from './RecordDrawer';
export { RecordMiniTimeline } from './RecordMiniTimeline';
export { InlineField } from './InlineField';
export { RowQuickActions } from './RowQuickActions';

// Stage Transitions
export { StageTransitionModal } from './StageTransitionModal';
export { BlockersPanel } from './BlockersPanel';

// Related Lists
export { RelatedLists } from './RelatedLists';
export { RelatedListTable } from './RelatedListTable';
export { ComposerBar } from './ComposerBar';

// Global Actions
export { GlobalSearchOverlay } from './GlobalSearchOverlay';
export { QuickCreateDrawer } from './QuickCreateDrawer';

// Hooks & Context
export { useRecordDrawer, RecordDrawerProvider } from './RecordDrawerContext';
export { useViewPreferences, ViewPreferencesProvider } from './ViewPreferencesContext';
