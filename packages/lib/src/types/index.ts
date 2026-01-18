export type { Database, Json } from './database';

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
  CommissionTier,
  CommissionTransaction,
  CommissionPayout,
  ImportJobStatus,
  ImportRowStatus,
  MembershipStatus,
  EnrollmentStatus,
  BillingStatus,
  CommissionTransactionStatus,
  CommissionPayoutStatus,
  // Vendor management types
  Vendor,
  VendorInsert,
  VendorUpdate,
  VendorFile,
  VendorFileInsert,
  VendorFileUpdate,
  VendorFileRow,
  VendorFileRowInsert,
  VendorChange,
  VendorChangeInsert,
  VendorConnector,
  VendorConnectorInsert,
  VendorConnectorUpdate,
} from './database';

// Re-export common types for convenience
export type UserRole = 'owner' | 'super_admin' | 'admin' | 'advisor' | 'staff';

// Team invitation types
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';
export type InvitableRole = 'super_admin' | 'admin' | 'advisor' | 'staff';

export interface TeamInvitation {
  id: string;
  organization_id: string;
  email: string;
  role: InvitableRole;
  status: InvitationStatus;
  token: string;
  expires_at: string;
  invited_by: string;
  accepted_by: string | null;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  display_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Role hierarchy for permission checks
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  owner: 5,
  super_admin: 4,
  admin: 3,
  advisor: 2,
  staff: 1,
};

export function canManageRole(userRole: UserRole, targetRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] > ROLE_HIERARCHY[targetRole];
}

export function getRoleLabel(role: UserRole): string {
  switch (role) {
    case 'owner': return 'Owner';
    case 'super_admin': return 'Super Admin';
    case 'admin': return 'Admin';
    case 'advisor': return 'Advisor';
    case 'staff': return 'Staff';
    default: return role;
  }
}
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

