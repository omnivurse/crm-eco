/**
 * Canonical Type Definitions — Single Source of Truth
 *
 * ALL row / insert / update types are derived from the Supabase-generated
 * Database type in ./database.ts.  Never hand-write an interface that
 * duplicates a table row.  If you need a subset, use  Pick<Member, 'id' | 'first_name'>
 * If you need a join shape, intersect:  Member & { advisor: Pick<Advisor, 'id' | 'first_name'> }
 */

export type { Database, Json } from './database';
import type { Database } from './database';

// ─────────────────────────────────────────────────────────────
// Generic helpers — use these in app code for any table
// ─────────────────────────────────────────────────────────────
type Tables = Database['public']['Tables'];

/** Extract the Row (SELECT) type for a given table */
export type TableRow<T extends keyof Tables> = Tables[T]['Row'];

/** Extract the Insert type for a given table */
export type TableInsert<T extends keyof Tables> = Tables[T]['Insert'];

/** Extract the Update type for a given table */
export type TableUpdate<T extends keyof Tables> = Tables[T]['Update'];

// ─────────────────────────────────────────────────────────────
// Core Row Types
// ─────────────────────────────────────────────────────────────
export type Organization = TableRow<'organizations'>;
export type Profile = TableRow<'profiles'>;
export type Advisor = TableRow<'advisors'>;
export type Member = TableRow<'members'>;
export type Lead = TableRow<'leads'>;
export type Activity = TableRow<'activities'>;
export type Ticket = TableRow<'tickets'>;
export type TicketComment = TableRow<'ticket_comments'>;
export type Need = TableRow<'needs'>;
export type NeedEvent = TableRow<'need_events'>;
export type CustomFieldDefinition = TableRow<'custom_field_definitions'>;
export type FieldMapping = TableRow<'field_mappings'>;
export type ImportJob = TableRow<'import_jobs'>;
export type ImportJobRow = TableRow<'import_job_rows'>;
export type ImportSnapshot = TableRow<'import_snapshots'>;
export type Plan = TableRow<'plans'>;
export type Membership = TableRow<'memberships'>;
export type Enrollment = TableRow<'enrollments'>;
export type EnrollmentStep = TableRow<'enrollment_steps'>;
export type EnrollmentAuditLog = TableRow<'enrollment_audit_log'>;
export type CommissionTier = TableRow<'commission_tiers'>;
export type CommissionTransaction = TableRow<'commission_transactions'>;
export type CommissionPayout = TableRow<'commission_payouts'>;
export type Note = TableRow<'notes'>;
export type Invoice = TableRow<'invoices'>;
export type EmailCampaign = TableRow<'email_campaigns'>;
export type CrmRecord = TableRow<'crm_records'>;
export type CrmModule = TableRow<'crm_modules'>;
export type CrmField = TableRow<'crm_fields'>;
export type CrmTask = TableRow<'crm_tasks'>;

// ─────────────────────────────────────────────────────────────
// Insert Types
// ─────────────────────────────────────────────────────────────
export type MemberInsert = TableInsert<'members'>;
export type AdvisorInsert = TableInsert<'advisors'>;
export type EnrollmentInsert = TableInsert<'enrollments'>;
export type TicketInsert = TableInsert<'tickets'>;
export type NeedInsert = TableInsert<'needs'>;
export type NoteInsert = TableInsert<'notes'>;
export type InvoiceInsert = TableInsert<'invoices'>;
export type CrmRecordInsert = TableInsert<'crm_records'>;
export type CrmTaskInsert = TableInsert<'crm_tasks'>;

// ─────────────────────────────────────────────────────────────
// Update Types
// ─────────────────────────────────────────────────────────────
export type MemberUpdate = TableUpdate<'members'>;
export type AdvisorUpdate = TableUpdate<'advisors'>;
export type EnrollmentUpdate = TableUpdate<'enrollments'>;
export type TicketUpdate = TableUpdate<'tickets'>;
export type NeedUpdate = TableUpdate<'needs'>;
export type NoteUpdate = TableUpdate<'notes'>;
export type InvoiceUpdate = TableUpdate<'invoices'>;

// ─────────────────────────────────────────────────────────────
// Vendor Types
// ─────────────────────────────────────────────────────────────
export type Vendor = TableRow<'vendors'>;
export type VendorFile = TableRow<'vendor_files'>;
export type VendorFileRow = TableRow<'vendor_file_rows'>;
export type VendorChange = TableRow<'vendor_changes'>;
export type VendorConnector = TableRow<'vendor_connectors'>;
export type VendorFileRowInsert = TableInsert<'vendor_file_rows'>;
export type VendorChangeInsert = TableInsert<'vendor_changes'>;
export type VendorConnectorInsert = TableInsert<'vendor_connectors'>;

// Vendor status/enum types — kept as string aliases for flexibility
export type VendorFileStatus = string;
export type VendorFileType = string;
export type VendorFileRowStatus = string;
export type VendorChangeStatus = string;
export type VendorConnectorType = string;
export type VendorConnectorStatus = string;

// Legacy aliases — no matching DB table; kept as any for back-compat.
// TODO: Remove these once all usages are migrated.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type VendorUser = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type VendorProduct = any;

// ─────────────────────────────────────────────────────────────
// Composite / Join Types — for common query shapes
// ─────────────────────────────────────────────────────────────
export type ImportJobWithRows = ImportJob & { rows?: ImportJobRow[] };
export type ImportJobRowWithValues = ImportJobRow;
export type MembershipWithPlan = Membership & { plans?: Pick<Plan, 'id' | 'name'> | null };
export type EnrollmentWithDetails = Enrollment & {
  primary_member?: Pick<Member, 'id' | 'first_name' | 'last_name' | 'email'> | null;
  plans?: Pick<Plan, 'id' | 'name'> | null;
};
export type CommissionTransactionWithAdvisor = CommissionTransaction & {
  advisors?: Pick<Advisor, 'id' | 'first_name' | 'last_name'> | null;
};
export type CommissionPayoutWithAdvisor = CommissionPayout & {
  advisors?: Pick<Advisor, 'id' | 'first_name' | 'last_name'> | null;
};

// ─────────────────────────────────────────────────────────────
// Status / Enum Types (from string literals)
// ─────────────────────────────────────────────────────────────
export type ImportJobStatus = string;
export type ImportRowStatus = string;
export type MembershipStatus = string;
export type EnrollmentStatus = string;
export type EnrollmentStepStatus = string;
export type CommissionTransactionStatus = string;
export type CommissionPayoutStatus = string;

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
