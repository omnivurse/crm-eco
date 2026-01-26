/**
 * Change Intelligence System - Constants
 */

import type { ChangeSeverity, ChangeSource, SyncStatus, ReconciliationStatus } from './types';

// Severity configuration
export const SEVERITY_CONFIG: Record<ChangeSeverity, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  indicator: string;
  priority: number;
}> = {
  critical: {
    label: 'Critical',
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
    indicator: '🔴',
    priority: 0,
  },
  high: {
    label: 'High',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/20',
    indicator: '🟠',
    priority: 1,
  },
  medium: {
    label: 'Medium',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/20',
    indicator: '🟡',
    priority: 2,
  },
  low: {
    label: 'Low',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/20',
    indicator: '🟢',
    priority: 3,
  },
  info: {
    label: 'Info',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    indicator: '🔵',
    priority: 4,
  },
};

// Source configuration
export const SOURCE_CONFIG: Record<ChangeSource, {
  label: string;
  icon: string;
  color: string;
}> = {
  user: {
    label: 'User',
    icon: 'User',
    color: 'text-blue-500',
  },
  system: {
    label: 'System',
    icon: 'Settings',
    color: 'text-slate-500',
  },
  integration: {
    label: 'Integration',
    icon: 'Plug',
    color: 'text-purple-500',
  },
  vendor: {
    label: 'Vendor',
    icon: 'Building',
    color: 'text-amber-500',
  },
  import: {
    label: 'Import',
    icon: 'Upload',
    color: 'text-emerald-500',
  },
};

// Sync status configuration
export const SYNC_STATUS_CONFIG: Record<SyncStatus, {
  label: string;
  color: string;
  bgColor: string;
  dotColor: string;
}> = {
  synced: {
    label: 'Synced',
    color: 'text-green-400',
    bgColor: 'bg-green-400/10',
    dotColor: 'bg-green-400',
  },
  pending: {
    label: 'Syncing...',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-400/10',
    dotColor: 'bg-yellow-400',
  },
  conflict: {
    label: 'Conflict',
    color: 'text-red-400',
    bgColor: 'bg-red-400/10',
    dotColor: 'bg-red-400',
  },
  stale: {
    label: 'Stale',
    color: 'text-slate-400',
    bgColor: 'bg-slate-400/10',
    dotColor: 'bg-slate-400',
  },
};

// Reconciliation status configuration
export const RECONCILIATION_CONFIG: Record<ReconciliationStatus, {
  label: string;
  color: string;
  bgColor: string;
}> = {
  none: {
    label: 'No Action',
    color: 'text-slate-400',
    bgColor: 'bg-slate-400/10',
  },
  pending: {
    label: 'Pending Review',
    color: 'text-amber-400',
    bgColor: 'bg-amber-400/10',
  },
  approved: {
    label: 'Approved',
    color: 'text-green-400',
    bgColor: 'bg-green-400/10',
  },
  rejected: {
    label: 'Rejected',
    color: 'text-red-400',
    bgColor: 'bg-red-400/10',
  },
  auto_resolved: {
    label: 'Auto-Resolved',
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
  },
};

// Common entity types
export const ENTITY_TYPES = [
  'record',
  'contact',
  'lead',
  'deal',
  'task',
  'note',
  'enrollment',
  'member',
  'ticket',
  'user',
  'setting',
  'integration',
  'workflow',
] as const;

// Common change types
export const CHANGE_TYPES = [
  'create',
  'update',
  'delete',
  'status_change',
  'stage_change',
  'assignment',
  'enrollment',
  'termination',
  'plan_change',
  'sync',
  'import',
  'merge',
  'restore',
] as const;

// Severity order for sorting/filtering
export const SEVERITY_ORDER: Record<ChangeSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

// Default feed settings
export const DEFAULT_FEED_SETTINGS = {
  maxEvents: 50,
  refreshInterval: 30000, // 30 seconds
  minSeverity: 'info' as ChangeSeverity,
  realtime: true,
};

// Entity type icons
export const ENTITY_ICONS: Record<string, string> = {
  record: 'FileText',
  contact: 'User',
  lead: 'UserPlus',
  deal: 'DollarSign',
  task: 'CheckSquare',
  note: 'StickyNote',
  enrollment: 'ClipboardCheck',
  member: 'Users',
  ticket: 'Ticket',
  user: 'UserCog',
  setting: 'Settings',
  integration: 'Plug',
  workflow: 'GitBranch',
};

// Change type labels
export const CHANGE_TYPE_LABELS: Record<string, string> = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
  status_change: 'Status Changed',
  stage_change: 'Stage Changed',
  assignment: 'Assigned',
  enrollment: 'Enrolled',
  termination: 'Terminated',
  plan_change: 'Plan Changed',
  sync: 'Synced',
  import: 'Imported',
  merge: 'Merged',
  restore: 'Restored',
};
