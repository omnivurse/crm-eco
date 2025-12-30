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

