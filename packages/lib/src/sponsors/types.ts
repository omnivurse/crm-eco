export type SponsorStatus = 'draft' | 'active' | 'inactive';
export type RosterStatus = 'eligible' | 'pending_approval' | 'enrolled' | 'terminated';
export type SponsorRelationship = 'employee' | 'spouse' | 'child';
export type SponsorshipStatus = 'pending' | 'active' | 'ended' | 'needs_approval';
export type RosterImportAction = 'insert' | 'update' | 'terminate' | 'match' | 'error' | 'skip';

export interface Sponsor {
  id: string;
  organization_id: string;
  name: string;
  legal_name: string | null;
  status: SponsorStatus;
  billing_start_date: string | null;
  enrollment_cutoff_day: number;
  backbill_months: number;
  dependent_cap: number | null;
  allow_multiple_plans: boolean;
  default_plan_id: string | null;
  billing_email: string | null;
  phone: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
}

export interface RosterPersonInput {
  first_name: string;
  last_name: string;
  date_of_birth?: string | null;
  email?: string | null;
  external_id?: string | null;
  relationship?: SponsorRelationship;
  eligible_start?: string | null;
  eligible_end?: string | null;
  subscriber_external_id?: string | null;
}

export interface RosterImportRowResult {
  row_number: number;
  action: RosterImportAction;
  message?: string;
  match_key: string;
  payload: RosterPersonInput;
}

export interface RosterImportResult {
  total_rows: number;
  matched_rows: number;
  inserted_rows: number;
  updated_rows: number;
  terminated_rows: number;
  error_rows: number;
  rows: RosterImportRowResult[];
}

export interface RosterMatch {
  roster_id: string;
  status: RosterStatus;
  relationship: SponsorRelationship;
  member_id: string | null;
}

export interface EnrollmentMatchDecision {
  outcome: 'matched' | 'needs_approval' | 'no_sponsor';
  roster?: RosterMatch;
  reason: string;
}

export interface SponsorInvoiceLine {
  roster_id: string | null;
  member_id: string | null;
  membership_id: string | null;
  name: string;
  role: SponsorRelationship;
  amount: number;
  plan_id: string | null;
  plan_name: string | null;
}

export interface SponsorInvoiceDraft {
  sponsor_id: string;
  organization_id: string;
  period_start: string;
  period_end: string;
  title: string;
  line_items: SponsorInvoiceLine[];
  subtotal: number;
  total: number;
  headcount: number;
  already_exists?: boolean;
  invoice_id?: string | null;
}
