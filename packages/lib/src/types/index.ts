export type { Database } from './database';

// Re-export table types
export type {
  Organization,
  Profile,
  Advisor,
  Member,
  Lead,
  Activity,
  Ticket,
  TicketComment,
  Need,
  NeedEvent,
  CustomFieldDefinition,
  FieldMapping,
  ImportJob,
  ImportJobRow,
  ImportSnapshot,
  Plan,
  Membership,
  Enrollment,
  EnrollmentStep,
  EnrollmentAuditLog,
  ImportJobStatus,
  ImportRowStatus,
  MembershipStatus,
  EnrollmentStatus,
  BillingStatus,
} from './database';

// Re-export common types for convenience
export type UserRole = 'owner' | 'admin' | 'advisor' | 'staff';
export type MemberStatus = 'pending' | 'active' | 'inactive' | 'terminated';
export type AdvisorStatus = 'pending' | 'active' | 'inactive' | 'terminated';
export type LeadStatus = 'new' | 'contacted' | 'working' | 'qualified' | 'converted' | 'unqualified' | 'lost';
export type TicketStatus = 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TicketCategory = 'need' | 'enrollment' | 'billing' | 'service' | 'other';
// Need status - granular workflow states
export type NeedStatus =
  | 'new'
  | 'open'                     // Legacy/alias for new (backwards compat)
  | 'submitted'
  | 'intake'
  | 'awaiting_member_docs'
  | 'awaiting_provider_docs'
  | 'in_review'
  | 'pricing'
  | 'approved'
  | 'reimbursement_pending'
  | 'processing'
  | 'paid'
  | 'closed'
  | 'denied'
  | 'cancelled';

// Open/active need statuses (not yet resolved)
export const OPEN_NEED_STATUSES: NeedStatus[] = [
  'new',
  'open',
  'submitted',
  'intake',
  'awaiting_member_docs',
  'awaiting_provider_docs',
  'in_review',
  'pricing',
  'approved',
  'reimbursement_pending',
  'processing',
];

// Terminal need statuses (final states)
export const TERMINAL_NEED_STATUSES: NeedStatus[] = [
  'paid',
  'closed',
  'denied',
  'cancelled',
];

// Helper to check if a status is terminal
export function isTerminalNeedStatus(status: NeedStatus): boolean {
  return TERMINAL_NEED_STATUSES.includes(status);
}

// Helper to get friendly label for a need status
export function getNeedStatusLabel(status: NeedStatus): string {
  switch (status) {
    case 'new':
    case 'open':
      return 'New';
    case 'submitted':
      return 'Submitted';
    case 'intake':
      return 'Intake';
    case 'awaiting_member_docs':
      return 'Waiting on Member';
    case 'awaiting_provider_docs':
      return 'Waiting on Provider';
    case 'in_review':
      return 'In Review';
    case 'pricing':
      return 'Pricing';
    case 'approved':
      return 'Approved';
    case 'reimbursement_pending':
      return 'Reimbursement Pending';
    case 'processing':
      return 'Processing';
    case 'paid':
      return 'Paid / Shared';
    case 'closed':
      return 'Closed';
    case 'denied':
      return 'Not Approved';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
}

export type UrgencyLight = 'green' | 'orange' | 'red';

// Import entity type
export type ImportEntityType = 'member' | 'advisor' | 'lead';

