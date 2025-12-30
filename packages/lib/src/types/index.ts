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
  ImportJob,
  ImportJobRow,
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
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
export type TicketStatus = 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TicketCategory = 'need' | 'enrollment' | 'billing' | 'service' | 'other';
export type NeedStatus = 'open' | 'in_review' | 'paid' | 'closed';
export type UrgencyLight = 'green' | 'orange' | 'red';

// Import entity type
export type ImportEntityType = 'member' | 'advisor' | 'lead';

