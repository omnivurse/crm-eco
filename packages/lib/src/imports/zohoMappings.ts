/**
 * Zoho CRM Default Field Mappings
 * 
 * Pre-configured column mappings for common Zoho CRM export formats.
 * These can be used as starting points for the field mapper.
 */

import type { EntityType } from './fieldMapping';

// ============================================================================
// ZOHO MEMBER/CONTACT MAPPINGS
// ============================================================================

/**
 * Common Zoho CRM Contacts/Members field mappings
 */
export const ZOHO_MEMBER_COLUMN_MAP: Record<string, string> = {
  // Name fields
  'first_name': 'first_name',
  'first name': 'first_name',
  'firstname': 'first_name',
  'last_name': 'last_name',
  'last name': 'last_name',
  'lastname': 'last_name',
  'full_name': 'first_name', // Will need post-processing
  'contact_name': 'first_name',
  
  // Email
  'email': 'email',
  'email_address': 'email',
  'primary_email': 'email',
  'contact_email': 'email',
  
  // Phone
  'phone': 'phone',
  'phone_number': 'phone',
  'mobile': 'phone',
  'mobile_phone': 'phone',
  'primary_phone': 'phone',
  
  // Date of birth
  'date_of_birth': 'date_of_birth',
  'dob': 'date_of_birth',
  'birthdate': 'date_of_birth',
  'birth_date': 'date_of_birth',
  
  // Address
  'mailing_street': 'address_line1',
  'street': 'address_line1',
  'address': 'address_line1',
  'address_line1': 'address_line1',
  'mailing_city': 'city',
  'city': 'city',
  'mailing_state': 'state',
  'state': 'state',
  'mailing_zip': 'postal_code',
  'mailing_code': 'postal_code',
  'zip': 'postal_code',
  'zip_code': 'postal_code',
  'postal_code': 'postal_code',
  
  // Member-specific
  'member_id': 'member_number',
  'member_number': 'member_number',
  'membership_id': 'member_number',
  'contact_id': 'member_number',
  'record_id': 'member_number',
  
  // Status
  'status': 'status',
  'member_status': 'status',
  'contact_status': 'status',
  'account_status': 'status',
  
  // Gender
  'gender': 'gender',
  'sex': 'gender',
  
  // Plan info
  'plan': 'plan_name',
  'plan_name': 'plan_name',
  'product': 'plan_name',
  'plan_type': 'plan_type',
  'coverage': 'plan_type',
  
  // Dates
  'effective_date': 'effective_date',
  'start_date': 'effective_date',
  'enrollment_date': 'effective_date',
  'end_date': 'termination_date',
  'termination_date': 'termination_date',
  'cancel_date': 'termination_date',
  
  // Financial
  'monthly_amount': 'monthly_share',
  'monthly_share': 'monthly_share',
  'monthly_premium': 'monthly_share',
  'share_amount': 'monthly_share',
  
  // Advisor linking
  'owner_email': 'advisor_email',
  'assigned_to_email': 'advisor_email',
  'agent_email': 'advisor_email',
  'rep_email': 'advisor_email',
  'advisor_email': 'advisor_email',
  'owner_id': 'advisor_code',
  'agent_code': 'advisor_code',
  'rep_code': 'advisor_code',
};

// ============================================================================
// ZOHO ADVISOR/AGENT MAPPINGS
// ============================================================================

/**
 * Common Zoho CRM Users/Agents field mappings
 */
export const ZOHO_ADVISOR_COLUMN_MAP: Record<string, string> = {
  // Name
  'first_name': 'first_name',
  'first name': 'first_name',
  'last_name': 'last_name',
  'last name': 'last_name',
  'full_name': 'first_name',
  'user_name': 'first_name',
  
  // Email
  'email': 'email',
  'email_address': 'email',
  'user_email': 'email',
  
  // Phone
  'phone': 'phone',
  'mobile': 'phone',
  'phone_number': 'phone',
  
  // Agency
  'company': 'agency_name',
  'company_name': 'agency_name',
  'agency': 'agency_name',
  'agency_name': 'agency_name',
  'organization': 'agency_name',
  
  // License
  'license': 'license_number',
  'license_number': 'license_number',
  'license_no': 'license_number',
  'states': 'license_states',
  'license_states': 'license_states',
  'licensed_states': 'license_states',
  
  // NPN
  'npn': 'npn',
  'national_producer_number': 'npn',
  
  // Code/ID
  'user_id': 'advisor_code',
  'agent_id': 'advisor_code',
  'agent_code': 'advisor_code',
  'advisor_code': 'advisor_code',
  'rep_code': 'advisor_code',
  'code': 'advisor_code',
  
  // Status
  'status': 'status',
  'user_status': 'status',
  'active': 'status',
  
  // Commission
  'commission_tier': 'commission_tier',
  'tier': 'commission_tier',
  'level': 'commission_tier',
  'comp_level': 'commission_tier',
  
  // Hierarchy
  'manager_email': 'parent_advisor_email',
  'upline_email': 'parent_advisor_email',
  'reports_to_email': 'parent_advisor_email',
  'parent_email': 'parent_advisor_email',
};

// ============================================================================
// ZOHO LEAD MAPPINGS
// ============================================================================

/**
 * Common Zoho CRM Leads field mappings
 */
export const ZOHO_LEAD_COLUMN_MAP: Record<string, string> = {
  // Name
  'first_name': 'first_name',
  'first name': 'first_name',
  'last_name': 'last_name',
  'last name': 'last_name',
  'lead_name': 'first_name',
  
  // Email
  'email': 'email',
  'email_address': 'email',
  'primary_email': 'email',
  
  // Phone
  'phone': 'phone',
  'mobile': 'phone',
  'phone_number': 'phone',
  
  // Location
  'state': 'state',
  'mailing_state': 'state',
  
  // Source
  'lead_source': 'source',
  'source': 'source',
  'utm_source': 'source',
  'referral_source': 'source',
  'campaign': 'campaign',
  'utm_campaign': 'campaign',
  'campaign_name': 'campaign',
  
  // Status
  'status': 'status',
  'lead_status': 'status',
  
  // Notes
  'notes': 'notes',
  'description': 'notes',
  'comments': 'notes',
  
  // Household
  'household_size': 'household_size',
  'family_size': 'household_size',
  'number_of_dependents': 'household_size',
  
  // Advisor linking
  'owner_email': 'advisor_email',
  'assigned_to_email': 'advisor_email',
  'agent_email': 'advisor_email',
};

// ============================================================================
// ZOHO PLAN/PRODUCT MAPPINGS
// ============================================================================

/**
 * Common Zoho CRM Products field mappings
 */
export const ZOHO_PLAN_COLUMN_MAP: Record<string, string> = {
  'product_name': 'name',
  'name': 'name',
  'plan_name': 'name',
  
  'product_code': 'code',
  'code': 'code',
  'sku': 'code',
  'plan_code': 'code',
  
  'description': 'description',
  'product_description': 'description',
  
  'product_category': 'product_line',
  'category': 'product_line',
  'product_line': 'product_line',
  
  'coverage_type': 'coverage_category',
  'coverage_category': 'coverage_category',
  
  'unit_price': 'monthly_share',
  'price': 'monthly_share',
  'monthly_share': 'monthly_share',
  'monthly_amount': 'monthly_share',
  
  'enrollment_fee': 'enrollment_fee',
  'setup_fee': 'enrollment_fee',
  
  'active': 'is_active',
  'is_active': 'is_active',
  'status': 'is_active',
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get the Zoho column map for a given entity type
 */
export function getZohoColumnMap(entityType: EntityType): Record<string, string> {
  switch (entityType) {
    case 'member':
      return ZOHO_MEMBER_COLUMN_MAP;
    case 'advisor':
      return ZOHO_ADVISOR_COLUMN_MAP;
    case 'lead':
      return ZOHO_LEAD_COLUMN_MAP;
    case 'plan':
      return ZOHO_PLAN_COLUMN_MAP;
    case 'membership':
      // Memberships typically need custom mapping
      return {};
    default:
      return {};
  }
}

/**
 * Common Zoho date formats that need parsing
 */
export const ZOHO_DATE_FORMATS = [
  'MM/DD/YYYY',
  'YYYY-MM-DD',
  'DD-MM-YYYY',
  'MMM DD, YYYY',
  'DD MMM YYYY',
];

/**
 * Common Zoho status value mappings
 */
export const ZOHO_MEMBER_STATUS_MAP: Record<string, string> = {
  'active': 'active',
  'Active': 'active',
  'ACTIVE': 'active',
  'pending': 'pending',
  'Pending': 'pending',
  'PENDING': 'pending',
  'inactive': 'inactive',
  'Inactive': 'inactive',
  'INACTIVE': 'inactive',
  'terminated': 'terminated',
  'Terminated': 'terminated',
  'TERMINATED': 'terminated',
  'cancelled': 'terminated',
  'Cancelled': 'terminated',
  'CANCELLED': 'terminated',
  'prospect': 'prospect',
  'Prospect': 'prospect',
  'PROSPECT': 'prospect',
};

export const ZOHO_LEAD_STATUS_MAP: Record<string, string> = {
  'new': 'new',
  'New': 'new',
  'NEW': 'new',
  'contacted': 'contacted',
  'Contacted': 'contacted',
  'CONTACTED': 'contacted',
  'working': 'working',
  'Working': 'working',
  'WORKING': 'working',
  'In Progress': 'working',
  'qualified': 'qualified',
  'Qualified': 'qualified',
  'QUALIFIED': 'qualified',
  'converted': 'converted',
  'Converted': 'converted',
  'CONVERTED': 'converted',
  'lost': 'lost',
  'Lost': 'lost',
  'LOST': 'lost',
  'Closed Lost': 'lost',
  'unqualified': 'unqualified',
  'Unqualified': 'unqualified',
  'UNQUALIFIED': 'unqualified',
  'Not Qualified': 'unqualified',
};
