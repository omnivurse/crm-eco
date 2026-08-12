import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types';

export type ImportResult = {
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: { rowIndex: number; message: string }[];
};

export type ImportRowData = {
  index: number;
  data: Record<string, string>;
};

export type ImportContext = {
  supabase: SupabaseClient<Database>;
  organizationId: string;
  profileId: string;
  jobId: string;
};

// Member column mappings (CSV header -> DB column)
export const MEMBER_COLUMN_MAP: Record<string, string> = {
  first_name: 'first_name',
  firstname: 'first_name',
  'first name': 'first_name',
  last_name: 'last_name',
  lastname: 'last_name',
  'last name': 'last_name',
  email: 'email',
  email_address: 'email',
  phone: 'phone',
  phone_number: 'phone',
  state: 'state',
  date_of_birth: 'date_of_birth',
  dob: 'date_of_birth',
  birthdate: 'date_of_birth',
  member_number: 'member_number',
  member_id: 'member_number',
  status: 'status',
  address: 'address_line1',
  address_line1: 'address_line1',
  address_line2: 'address_line2',
  city: 'city',
  zip: 'postal_code',
  zip_code: 'postal_code',
  postal_code: 'postal_code',
  gender: 'gender',
};

// Advisor column mappings
export const ADVISOR_COLUMN_MAP: Record<string, string> = {
  first_name: 'first_name',
  firstname: 'first_name',
  'first name': 'first_name',
  last_name: 'last_name',
  lastname: 'last_name',
  'last name': 'last_name',
  email: 'email',
  email_address: 'email',
  phone: 'phone',
  phone_number: 'phone',
  agency_name: 'agency_name',
  agency: 'agency_name',
  license_number: 'license_number',
  license: 'license_number',
  license_states: 'license_states',
  states: 'license_states',
  npn: 'npn',
  status: 'status',
  advisor_code: 'advisor_code',
  code: 'advisor_code',
  // Parent producer / upline (resolved by name, email, or code)
  parent_producer: 'parent_advisor_lookup',
  parent_advisor: 'parent_advisor_lookup',
  upline: 'parent_advisor_lookup',
  parent: 'parent_advisor_lookup',
  // Producer code (human-readable, e.g. "WENDY")
  producer_code: 'producer_code',
  prod_code: 'producer_code',
  // Admin123 Agent ID
  admin123_agent_id: 'admin123_agent_id',
  admin123: 'admin123_agent_id',
  agent_id_number: 'admin123_agent_id',
  // Producer type
  producer_type: 'producer_type',
  'producer type': 'producer_type',
  type: 'producer_type',
  // Mobile phone
  mobile: 'mobile_phone',
  mobile_phone: 'mobile_phone',
  cell: 'mobile_phone',
  'cell phone': 'mobile_phone',
  // Website
  website: 'website_url',
  website_url: 'website_url',
  // Master Click Funnel
  master_click_funnel: 'master_click_funnel',
  click_funnel: 'master_click_funnel',
  // MPB Certified
  mpb_certified: 'mpb_certified',
  certified: 'mpb_certified',
  // MPB E&O Current
  mpb_eo_current: 'mpb_eo_current',
  eo_current: 'mpb_eo_current',
  'e&o current': 'mpb_eo_current',
  // CRM Owner
  crm_owner: 'crm_owner',
  // Referring affiliate (resolved by name, email, or code)
  referring_affiliate: 'referring_affiliate_lookup',
  referrer: 'referring_affiliate_lookup',
  // Setup fee waived
  setup_fee_waived: 'setup_fee_waived',
  // Compliance training completed date
  compliance_training_completed: 'compliance_training_completed',
  compliance_date: 'compliance_training_completed',
  // Producer owner (resolved by name, email, or code)
  producer_owner: 'producer_owner_lookup',
  owner: 'producer_owner_lookup',
};

// Lead column mappings
export const LEAD_COLUMN_MAP: Record<string, string> = {
  first_name: 'first_name',
  firstname: 'first_name',
  'first name': 'first_name',
  last_name: 'last_name',
  lastname: 'last_name',
  'last name': 'last_name',
  email: 'email',
  email_address: 'email',
  phone: 'phone',
  phone_number: 'phone',
  'phone belongs to': 'phone_owner',
  phone_belongs_to: 'phone_owner',
  'phone owner name': 'phone_owner_name',
  phone_owner_name: 'phone_owner_name',
  mobile: 'mobile',
  'mobile belongs to': 'mobile_owner',
  mobile_belongs_to: 'mobile_owner',
  'mobile owner name': 'mobile_owner_name',
  mobile_owner_name: 'mobile_owner_name',
  mobile_2: 'mobile_2',
  'mobile 2': 'mobile_2',
  'mobile 2 belongs to': 'mobile_2_owner',
  mobile_2_belongs_to: 'mobile_2_owner',
  'mobile 2 owner name': 'mobile_2_owner_name',
  mobile_2_owner_name: 'mobile_2_owner_name',
  state: 'state',
  source: 'source',
  lead_source: 'source',
  campaign: 'campaign',
  status: 'status',
  household_size: 'household_size',
  notes: 'notes',
};

// Valid status values
export const VALID_MEMBER_STATUSES = ['prospect', 'pending', 'active', 'paused', 'terminated', 'inactive'];
export const VALID_ADVISOR_STATUSES = ['pending', 'active', 'paused', 'inactive', 'terminated'];
export const VALID_LEAD_STATUSES = ['new', 'contacted', 'working', 'qualified', 'unqualified', 'converted', 'lost'];

