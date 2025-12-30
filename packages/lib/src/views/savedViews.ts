/**
 * Shared types for Personal Saved Views across CRM boards.
 * Each context (needs, tickets, leads) has its own filter type and context constant.
 */

// Import base types from types module to avoid duplication
import type {
  TicketStatus,
  TicketCategory,
  TicketPriority,
  LeadStatus,
} from '../types';

// Re-export these for convenience
export type { TicketStatus, TicketCategory, TicketPriority, LeadStatus };

// ============================================================================
// TICKETS BOARD
// ============================================================================

/**
 * The serialized filter state for the Tickets Board.
 * Stored in saved_views.filters as JSONB.
 */
export type TicketsBoardSavedFilters = {
  /** Status filters */
  selectedStatuses?: TicketStatus[];

  /** Category filters */
  selectedCategories?: TicketCategory[];

  /** Priority filters */
  selectedPriorities?: TicketPriority[];

  /** Assignee filter */
  selectedAssigneeId?: string | 'all';

  /** Search term (subject, member, etc.) */
  search?: string;
};

/**
 * A saved view for the Tickets Board.
 */
export interface TicketsBoardSavedView {
  id: string;
  organization_id: string;
  owner_profile_id: string;
  context: 'tickets_board';
  name: string;
  is_default: boolean;
  filters: TicketsBoardSavedFilters;
  created_at: string;
  updated_at: string;
}

/**
 * Context identifier for Tickets Board saved views.
 */
export const TICKETS_BOARD_CONTEXT = 'tickets_board';

// ============================================================================
// LEADS BOARD
// ============================================================================

/**
 * Lead source values (extended beyond the base types).
 */
export type LeadSource =
  | 'website'
  | 'referral'
  | 'call_center'
  | 'social'
  | 'event'
  | 'partner'
  | 'other';

/**
 * The serialized filter state for the Leads Board.
 * Stored in saved_views.filters as JSONB.
 */
export type LeadsBoardSavedFilters = {
  /** Status filters */
  selectedStatuses?: LeadStatus[];

  /** Source filters */
  selectedSources?: LeadSource[];

  /** Advisor filter */
  selectedAdvisorId?: string | 'all';

  /** Search term (name, email, phone, etc.) */
  search?: string;
};

/**
 * A saved view for the Leads Board.
 */
export interface LeadsBoardSavedView {
  id: string;
  organization_id: string;
  owner_profile_id: string;
  context: 'leads_board';
  name: string;
  is_default: boolean;
  filters: LeadsBoardSavedFilters;
  created_at: string;
  updated_at: string;
}

/**
 * Context identifier for Leads Board saved views.
 */
export const LEADS_BOARD_CONTEXT = 'leads_board';

// ============================================================================
// SHARED CONSTANTS
// ============================================================================

/**
 * All ticket statuses for UI dropdowns.
 */
export const TICKET_STATUSES: TicketStatus[] = [
  'open',
  'in_progress',
  'waiting',
  'resolved',
  'closed',
];

/**
 * All ticket categories for UI dropdowns.
 */
export const TICKET_CATEGORIES: TicketCategory[] = [
  'need',
  'enrollment',
  'billing',
  'service',
  'other',
];

/**
 * All ticket priorities for UI dropdowns.
 */
export const TICKET_PRIORITIES: TicketPriority[] = [
  'low',
  'normal',
  'high',
  'urgent',
];

/**
 * All lead statuses for UI dropdowns.
 */
export const LEAD_STATUSES: LeadStatus[] = [
  'new',
  'contacted',
  'working',
  'qualified',
  'converted',
  'unqualified',
  'lost',
];

/**
 * All lead sources for UI dropdowns.
 */
export const LEAD_SOURCES: LeadSource[] = [
  'website',
  'referral',
  'call_center',
  'social',
  'event',
  'partner',
  'other',
];

/**
 * Helper to get ticket status label.
 */
export function getTicketStatusLabel(status: TicketStatus): string {
  const labels: Record<TicketStatus, string> = {
    open: 'Open',
    in_progress: 'In Progress',
    waiting: 'Waiting',
    resolved: 'Resolved',
    closed: 'Closed',
  };
  return labels[status] || status;
}

/**
 * Helper to get ticket category label.
 */
export function getTicketCategoryLabel(category: TicketCategory): string {
  const labels: Record<TicketCategory, string> = {
    need: 'Need',
    enrollment: 'Enrollment',
    billing: 'Billing',
    service: 'Service',
    other: 'Other',
  };
  return labels[category] || category;
}

/**
 * Helper to get ticket priority label.
 */
export function getTicketPriorityLabel(priority: TicketPriority): string {
  const labels: Record<TicketPriority, string> = {
    low: 'Low',
    normal: 'Normal',
    high: 'High',
    urgent: 'Urgent',
  };
  return labels[priority] || priority;
}

/**
 * Helper to get lead status label.
 */
export function getLeadStatusLabel(status: LeadStatus): string {
  const labels: Record<LeadStatus, string> = {
    new: 'New',
    contacted: 'Contacted',
    working: 'Working',
    qualified: 'Qualified',
    converted: 'Converted',
    unqualified: 'Unqualified',
    lost: 'Lost',
  };
  return labels[status] || status;
}

/**
 * Helper to get lead source label.
 */
export function getLeadSourceLabel(source: LeadSource): string {
  const labels: Record<LeadSource, string> = {
    website: 'Website',
    referral: 'Referral',
    call_center: 'Call Center',
    social: 'Social Media',
    event: 'Event',
    partner: 'Partner',
    other: 'Other',
  };
  return labels[source] || source;
}

