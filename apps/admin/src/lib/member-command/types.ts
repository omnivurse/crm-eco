// Client-safe types + constants for the Member Command Center.
// MUST NOT import 'server-only' or any server-only module — this file is
// imported by the client MemberCommandCenter component. The server-only data
// loader lives in ./queries.ts (which re-exports these).
import type { DependentCoveragePeriod, summarizeRecentCoverageChanges } from '@crm-eco/lib';

export type MemberCommandTab =
  | 'overview'
  | 'profile'
  | 'household'
  | 'dependents'
  | 'enrollments'
  | 'coverage'
  | 'products'
  | 'billing'
  | 'invoices'
  | 'payment-profiles'
  | 'portal'
  | 'support'
  | 'documents'
  | 'activity'
  | 'audit'
  | 'communication'
  | 'tasks'
  | 'notes'
  | 'settings';

export const MEMBER_COMMAND_TABS: { id: MemberCommandTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'profile', label: 'Profile' },
  { id: 'household', label: 'Household' },
  { id: 'dependents', label: 'Dependents' },
  { id: 'enrollments', label: 'Enrollments' },
  { id: 'coverage', label: 'Coverage' },
  { id: 'products', label: 'Products' },
  { id: 'billing', label: 'Billing' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'payment-profiles', label: 'Payment Profiles' },
  { id: 'portal', label: 'Portal Access' },
  { id: 'support', label: 'Support' },
  { id: 'documents', label: 'Documents' },
  { id: 'activity', label: 'Activity' },
  { id: 'audit', label: 'Audit Log' },
  { id: 'communication', label: 'Communication' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'notes', label: 'Notes' },
  { id: 'settings', label: 'Settings' },
];

/** Tab → canonical backend (reuse first; build only when nothing exists). */
export const MEMBER_COMMAND_TAB_SOURCES: Record<
  MemberCommandTab,
  { tables: string[]; actions: string[]; components: string[] }
> = {
  overview: {
    tables: ['members', 'memberships', 'billing_schedules', 'dependents', 'enrollments'],
    actions: ['loadMemberCommandCenterData'],
    components: ['MemberCommandCenter'],
  },
  profile: {
    tables: ['members'],
    actions: ['MemberForm autosave'],
    components: ['MemberForm'],
  },
  household: {
    tables: ['dependents'],
    actions: ['loadMemberCommandCenterData'],
    components: ['MemberCommandCenter'],
  },
  dependents: {
    tables: ['dependents', 'dependent_coverage_periods'],
    actions: [
      'command-actions.ts → staffDependentCoverage (@crm-eco/lib)',
      'membershipBillingRecalc',
    ],
    components: ['AdminDependentCoveragePanel'],
  },
  enrollments: {
    tables: ['enrollments', 'plans'],
    actions: ['enrollments/actions.ts (approve/reject)'],
    components: ['MemberCommandCenter'],
  },
  coverage: {
    tables: ['dependent_coverage_periods', 'dependents'],
    actions: ['command-actions.ts → staffDependentCoverage'],
    components: ['AdminDependentCoveragePanel (readOnly)'],
  },
  products: {
    tables: ['memberships', 'plans'],
    actions: ['loadMemberCommandCenterData'],
    components: ['MemberCommandCenter'],
  },
  billing: {
    tables: ['billing_schedules', 'payment_profiles'],
    actions: ['MemberBillingTab client reads'],
    components: ['MemberBillingTab'],
  },
  invoices: {
    tables: ['invoices'],
    actions: ['loadMemberCommandCenterData'],
    components: ['MemberCommandCenter'],
  },
  'payment-profiles': {
    tables: ['payment_profiles'],
    actions: ['MemberBillingTab', '/api/billing/payment-profiles → BillingService'],
    components: ['MemberBillingTab'],
  },
  portal: {
    tables: ['members', 'auth.users'],
    actions: ['members/actions.ts inviteMemberToPortal → memberOnboarding.ts'],
    components: ['MemberPortalAccess'],
  },
  support: {
    tables: ['tickets', 'ticket_comments'],
    actions: ['getMemberTickets', 'support/actions.ts'],
    components: ['MemberCommandCenter support tab'],
  },
  documents: {
    tables: ['enrollment_contracts'],
    actions: ['loadMemberCommandCenterData'],
    components: ['MemberCommandCenter'],
  },
  activity: {
    tables: ['admin_activity_log'],
    actions: ['loadMemberCommandCenterData'],
    components: ['MemberCommandCenter'],
  },
  audit: {
    tables: ['enrollment_audit_log'],
    actions: ['enrollments/actions.ts'],
    components: ['MemberCommandCenter'],
  },
  communication: {
    tables: ['members.receive_emails', 'communication_preferences'],
    actions: [],
    components: [],
  },
  tasks: {
    tables: [],
    actions: [],
    components: [],
  },
  notes: {
    tables: [],
    actions: [],
    components: ['CRM record notes (linked contact)'],
  },
  settings: {
    tables: ['member_change_requests', 'members'],
    actions: ['MergeMembersModal', '/changes/review'],
    components: ['MergeMembersSection', 'MemberCommandCenter'],
  },
};

export interface MemberCommandCenterData {
  member: Record<string, unknown> & {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    status: string;
    advisor?: { id: string; first_name: string; last_name: string; email: string } | null;
  };
  activeMembership: Record<string, unknown> | null;
  billingSchedule: Record<string, unknown> | null;
  dependents: Record<string, unknown>[];
  coveragePeriods: DependentCoveragePeriod[];
  coveredCount: number;
  recentCoverageChanges: ReturnType<typeof summarizeRecentCoverageChanges>;
  enrollments: Record<string, unknown>[];
  memberships: Record<string, unknown>[];
  changeRequests: Record<string, unknown>[];
  invoices: Record<string, unknown>[];
  contracts: Record<string, unknown>[];
  adminActivity: Record<string, unknown>[];
  enrollmentAudit: Record<string, unknown>[];
  tickets: {
    id: string;
    subject: string;
    status: string;
    priority: string;
    category: string;
    created_at: string;
  }[];
  agents: { id: string; first_name: string; last_name: string; email: string }[];
  availablePlans: {
    id: string;
    name: string;
    code: string | null;
    plan_type: string | null;
    monthly_share: number | null;
  }[];
}
