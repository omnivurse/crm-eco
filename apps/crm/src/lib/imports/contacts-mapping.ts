/**
 * CRM Contacts Import Mapping Configuration
 * Maps CSV columns from Zoho CRM export to internal CRM field keys
 */

export interface FieldMapping {
  csvColumn: string;
  crmKey: string;
  type: 'text' | 'email' | 'phone' | 'date' | 'datetime' | 'number' | 'boolean' | 'currency';
  section: string;
  transform?: (value: string) => unknown;
}

// Helper functions for data transformation
const parseDate = (value: string): string | null => {
  if (!value || value === '' || value === '0000-00-00') return null;
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
  } catch {
    return null;
  }
};

const parseDateTime = (value: string): string | null => {
  if (!value || value === '') return null;
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch {
    return null;
  }
};

const parseNumber = (value: string): number | null => {
  if (!value || value === '') return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
};

const parseBoolean = (value: string): boolean => {
  if (!value) return false;
  return ['TRUE', 'YES', '1', 'T', 'Y'].includes(value.toUpperCase());
};

/**
 * Complete field mapping from Zoho CSV columns to CRM field keys
 */
export const CONTACTS_FIELD_MAPPING: FieldMapping[] = [
  // Core Contact Information
  { csvColumn: 'Record Id', crmKey: 'record_id', type: 'text', section: 'core' },
  { csvColumn: 'First Name', crmKey: 'first_name', type: 'text', section: 'core' },
  { csvColumn: 'Last Name', crmKey: 'last_name', type: 'text', section: 'core' },
  { csvColumn: 'Contact Name', crmKey: 'contact_name', type: 'text', section: 'core' },
  { csvColumn: 'Salutation', crmKey: 'salutation', type: 'text', section: 'core' },
  { csvColumn: 'Middle Initial', crmKey: 'middle_initial', type: 'text', section: 'core' },
  { csvColumn: 'Title', crmKey: 'title', type: 'text', section: 'core' },
  { csvColumn: 'Email', crmKey: 'email', type: 'email', section: 'core' },
  { csvColumn: 'Secondary Email', crmKey: 'secondary_email', type: 'email', section: 'core' },
  { csvColumn: 'Phone', crmKey: 'phone', type: 'phone', section: 'core' },
  { csvColumn: 'Mobile', crmKey: 'mobile', type: 'phone', section: 'core' },
  { csvColumn: 'Work Phone', crmKey: 'work_phone', type: 'phone', section: 'core' },
  { csvColumn: 'Fax', crmKey: 'fax', type: 'phone', section: 'core' },
  { csvColumn: 'Date of Birth', crmKey: 'date_of_birth', type: 'date', section: 'core', transform: parseDate },
  { csvColumn: 'Birth Month', crmKey: 'birth_month', type: 'text', section: 'core' },
  { csvColumn: 'Primary Member Gender', crmKey: 'primary_member_gender', type: 'text', section: 'core' },
  { csvColumn: 'Marital Status', crmKey: 'marital_status', type: 'text', section: 'core' },
  { csvColumn: 'Primary S.S Number', crmKey: 'primary_ss_number', type: 'text', section: 'core' },

  // Contact Management
  { csvColumn: 'Contact Status', crmKey: 'contact_status', type: 'text', section: 'management' },
  { csvColumn: 'Contact Owner', crmKey: 'contact_owner', type: 'text', section: 'management' },
  { csvColumn: 'Contact Owner.id', crmKey: 'contact_owner_id', type: 'text', section: 'management' },
  { csvColumn: 'Lead Source', crmKey: 'lead_source', type: 'text', section: 'management' },
  { csvColumn: 'Affiliate', crmKey: 'affiliate', type: 'text', section: 'management' },
  { csvColumn: 'Producer Name', crmKey: 'producer_name', type: 'text', section: 'management' },
  { csvColumn: 'Producer Name.id', crmKey: 'producer_name_id', type: 'text', section: 'management' },
  { csvColumn: 'Referral Source', crmKey: 'referral_source', type: 'text', section: 'management' },
  { csvColumn: 'Referring Member', crmKey: 'referring_member', type: 'text', section: 'management' },
  { csvColumn: 'Tag', crmKey: 'tag', type: 'text', section: 'management' },
  { csvColumn: 'Territories', crmKey: 'territories', type: 'text', section: 'management' },
  { csvColumn: 'Company/Association', crmKey: 'company_association', type: 'text', section: 'management' },
  { csvColumn: 'Data Source', crmKey: 'data_source', type: 'text', section: 'management' },

  // Address
  { csvColumn: 'Mailing Street', crmKey: 'mailing_street', type: 'text', section: 'address' },
  { csvColumn: 'Mailing City', crmKey: 'mailing_city', type: 'text', section: 'address' },
  { csvColumn: 'Mailing State', crmKey: 'mailing_state', type: 'text', section: 'address' },
  { csvColumn: 'Mailing Zip', crmKey: 'mailing_zip', type: 'text', section: 'address' },

  // Spouse
  { csvColumn: 'Spouse', crmKey: 'spouse', type: 'text', section: 'family_spouse' },
  { csvColumn: 'Spouse - DOB', crmKey: 'spouse_dob', type: 'date', section: 'family_spouse', transform: parseDate },
  { csvColumn: 'Spouse S.S. Number', crmKey: 'spouse_ss_number', type: 'text', section: 'family_spouse' },
  { csvColumn: 'Spouse Address', crmKey: 'spouse_address', type: 'text', section: 'family_spouse' },
  { csvColumn: 'Spouse Phone Number', crmKey: 'spouse_phone_number', type: 'phone', section: 'family_spouse' },
  { csvColumn: 'Spouse Email', crmKey: 'spouse_email', type: 'email', section: 'family_spouse' },

  // Children
  { csvColumn: 'Child 1', crmKey: 'child_1', type: 'text', section: 'family_children' },
  { csvColumn: 'Child 1-DOB', crmKey: 'child_1_dob', type: 'date', section: 'family_children', transform: parseDate },
  { csvColumn: 'Child 1 S.S. Number', crmKey: 'child_1_ss_number', type: 'text', section: 'family_children' },
  { csvColumn: 'Child 1 Address', crmKey: 'child_1_address', type: 'text', section: 'family_children' },
  { csvColumn: 'Child 1 Phone Number', crmKey: 'child_1_phone_number', type: 'phone', section: 'family_children' },
  { csvColumn: 'Child 1 Email', crmKey: 'child_1_email', type: 'email', section: 'family_children' },

  { csvColumn: 'Child 2', crmKey: 'child_2', type: 'text', section: 'family_children' },
  { csvColumn: 'Child 2-DOB', crmKey: 'child_2_dob', type: 'date', section: 'family_children', transform: parseDate },
  { csvColumn: 'Child 2 S.S. Number', crmKey: 'child_2_ss_number', type: 'text', section: 'family_children' },
  { csvColumn: 'Child 2 Address', crmKey: 'child_2_address', type: 'text', section: 'family_children' },
  { csvColumn: 'Child 2 Phone Number', crmKey: 'child_2_phone_number', type: 'phone', section: 'family_children' },
  { csvColumn: 'Child 2 Email', crmKey: 'child_2_email', type: 'email', section: 'family_children' },

  { csvColumn: 'Child 3', crmKey: 'child_3', type: 'text', section: 'family_children' },
  { csvColumn: 'Child 3 -DOB', crmKey: 'child_3_dob', type: 'date', section: 'family_children', transform: parseDate },
  { csvColumn: 'Child 3 S.S. Number', crmKey: 'child_3_ss_number', type: 'text', section: 'family_children' },
  { csvColumn: 'Child 3 Address', crmKey: 'child_3_address', type: 'text', section: 'family_children' },
  { csvColumn: 'Child 3 Phone Number', crmKey: 'child_3_phone_number', type: 'phone', section: 'family_children' },
  { csvColumn: 'Child 3 Email', crmKey: 'child_3_email', type: 'email', section: 'family_children' },

  { csvColumn: 'Child 4', crmKey: 'child_4', type: 'text', section: 'family_children' },
  { csvColumn: 'Child 4 -DOB', crmKey: 'child_4_dob', type: 'date', section: 'family_children', transform: parseDate },
  { csvColumn: 'Child 4 S.S. Number', crmKey: 'child_4_ss_number', type: 'text', section: 'family_children' },
  { csvColumn: 'Child 4 Address', crmKey: 'child_4_address', type: 'text', section: 'family_children' },
  { csvColumn: 'Child 4 Phone Number', crmKey: 'child_4_phone_number', type: 'phone', section: 'family_children' },
  { csvColumn: 'Child 4 Email', crmKey: 'child_4_email', type: 'email', section: 'family_children' },

  { csvColumn: 'Child 5', crmKey: 'child_5', type: 'text', section: 'family_children' },
  { csvColumn: 'Child 5 -DOB', crmKey: 'child_5_dob', type: 'date', section: 'family_children', transform: parseDate },
  { csvColumn: 'Child 5 S.S. Number', crmKey: 'child_5_ss_number', type: 'text', section: 'family_children' },
  { csvColumn: 'Child 5 Address', crmKey: 'child_5_address', type: 'text', section: 'family_children' },
  { csvColumn: 'Child 5 Phone Number', crmKey: 'child_5_phone_number', type: 'phone', section: 'family_children' },
  { csvColumn: 'Child 5 Email', crmKey: 'child_5_email', type: 'email', section: 'family_children' },

  // Insurance/Product
  { csvColumn: 'Carrier', crmKey: 'carrier', type: 'text', section: 'insurance' },
  { csvColumn: 'Previous Product', crmKey: 'previous_product', type: 'text', section: 'insurance' },
  { csvColumn: 'Product', crmKey: 'product', type: 'text', section: 'insurance' },
  { csvColumn: 'Coverage Option', crmKey: 'coverage_option', type: 'text', section: 'insurance' },
  { csvColumn: 'Monthly Premium', crmKey: 'monthly_premium', type: 'currency', section: 'insurance', transform: parseNumber },
  { csvColumn: 'Start Date', crmKey: 'start_date', type: 'date', section: 'insurance', transform: parseDate },
  { csvColumn: 'Cancellation Date', crmKey: 'cancellation_date', type: 'datetime', section: 'insurance', transform: parseDateTime },
  { csvColumn: 'IUA Amount', crmKey: 'iua_amount', type: 'currency', section: 'insurance', transform: parseNumber },
  { csvColumn: 'Vision', crmKey: 'vision', type: 'text', section: 'insurance' },
  { csvColumn: 'Dental', crmKey: 'dental', type: 'text', section: 'insurance' },
  { csvColumn: 'Add on Product', crmKey: 'add_on_product', type: 'text', section: 'insurance' },

  // Payment
  { csvColumn: 'Payment Method', crmKey: 'payment_method', type: 'text', section: 'payment' },
  { csvColumn: 'Account Type', crmKey: 'account_type', type: 'text', section: 'payment' },
  { csvColumn: 'Routing Number', crmKey: 'routing_number', type: 'text', section: 'payment' },
  { csvColumn: 'Account Number', crmKey: 'account_number', type: 'text', section: 'payment' },
  { csvColumn: 'Currency', crmKey: 'currency', type: 'text', section: 'payment' },
  { csvColumn: 'Exchange Rate', crmKey: 'exchange_rate', type: 'number', section: 'payment', transform: parseNumber },

  // Commissions
  { csvColumn: 'Commission Percentage', crmKey: 'commission_percentage', type: 'number', section: 'commissions', transform: parseNumber },
  { csvColumn: 'Amount Received', crmKey: 'amount_received', type: 'currency', section: 'commissions', transform: parseNumber },
  { csvColumn: 'Producer Commission', crmKey: 'producer_commission', type: 'currency', section: 'commissions', transform: parseNumber },
  { csvColumn: 'Team Leader', crmKey: 'team_leader', type: 'text', section: 'commissions' },
  { csvColumn: 'Team Leader Monthly', crmKey: 'team_leader_monthly', type: 'currency', section: 'commissions', transform: parseNumber },
  { csvColumn: 'Team Leader Referral', crmKey: 'team_leader_referral', type: 'currency', section: 'commissions', transform: parseNumber },
  { csvColumn: 'Director', crmKey: 'director', type: 'text', section: 'commissions' },
  { csvColumn: 'Director Monthly', crmKey: 'director_monthly', type: 'currency', section: 'commissions', transform: parseNumber },
  { csvColumn: 'Director Referral', crmKey: 'director_referral', type: 'currency', section: 'commissions', transform: parseNumber },
  { csvColumn: 'Affiliate Referral', crmKey: 'affiliate_referral', type: 'text', section: 'commissions' },
  { csvColumn: 'Affiliate Rep  Monthly', crmKey: 'affiliate_rep_monthly', type: 'currency', section: 'commissions', transform: parseNumber },
  { csvColumn: 'MPB Referral Fee', crmKey: 'mpb_referral_fee', type: 'currency', section: 'commissions', transform: parseNumber },
  { csvColumn: 'Date Referral Paid', crmKey: 'date_referral_paid', type: 'date', section: 'commissions', transform: parseDate },
  { csvColumn: 'Referral requirement satisfied', crmKey: 'referral_requirement_satisfied', type: 'text', section: 'commissions' },
  { csvColumn: 'Declined', crmKey: 'declined', type: 'boolean', section: 'commissions', transform: parseBoolean },
  { csvColumn: 'Charge Waived', crmKey: 'charge_waived', type: 'boolean', section: 'commissions', transform: parseBoolean },

  // Identifiers
  { csvColumn: 'MPower Life Code', crmKey: 'mpower_life_code', type: 'text', section: 'identifiers' },
  { csvColumn: '2nd Life Code', crmKey: 'life_code_2nd', type: 'text', section: 'identifiers' },
  { csvColumn: '3rd Life Code', crmKey: 'life_code_3rd', type: 'text', section: 'identifiers' },
  { csvColumn: '4th Life Code', crmKey: 'life_code_4th', type: 'text', section: 'identifiers' },
  { csvColumn: '5th Life Code', crmKey: 'life_code_5th', type: 'text', section: 'identifiers' },
  { csvColumn: 'E123 Member ID', crmKey: 'e123_member_id', type: 'text', section: 'identifiers' },

  // Portal
  { csvColumn: 'MPB Portal Username', crmKey: 'mpb_portal_username', type: 'text', section: 'portal' },
  { csvColumn: 'MPB Portal Password', crmKey: 'mpb_portal_password', type: 'text', section: 'portal' },
  { csvColumn: 'Cirrus registration Date', crmKey: 'cirrus_registration_date', type: 'date', section: 'portal', transform: parseDate },
  { csvColumn: 'MPB APP Downloaded', crmKey: 'mpb_app_downloaded', type: 'boolean', section: 'portal', transform: parseBoolean },
  { csvColumn: 'Select Conversion Completed', crmKey: 'select_conversion_completed', type: 'boolean', section: 'portal', transform: parseBoolean },

  // Compliance
  { csvColumn: 'MEC Submitted', crmKey: 'mec_submitted', type: 'boolean', section: 'compliance', transform: parseBoolean },
  { csvColumn: 'MEC Decision Confirmed', crmKey: 'mec_decision_confirmed', type: 'boolean', section: 'compliance', transform: parseBoolean },
  { csvColumn: 'Medical Release Form on File', crmKey: 'medical_release_form_on_file', type: 'boolean', section: 'compliance', transform: parseBoolean },
  { csvColumn: 'Permission to Discuss Plan', crmKey: 'permission_to_discuss_plan', type: 'boolean', section: 'compliance', transform: parseBoolean },
  { csvColumn: 'ATAP', crmKey: 'atap', type: 'text', section: 'compliance' },
  { csvColumn: 'Third Party Payor', crmKey: 'third_party_payor', type: 'text', section: 'compliance' },
  { csvColumn: 'Data Processing Basis', crmKey: 'data_processing_basis', type: 'text', section: 'compliance' },
  { csvColumn: 'Risk assessment paid', crmKey: 'risk_assessment_paid', type: 'text', section: 'compliance' },

  // Fulfillment
  { csvColumn: 'Welcome Call Status', crmKey: 'welcome_call_status', type: 'text', section: 'fulfillment' },
  { csvColumn: 'Welcome call performed by', crmKey: 'welcome_call_performed_by', type: 'text', section: 'fulfillment' },
  { csvColumn: 'WC Outreach Date', crmKey: 'wc_outreach_date', type: 'date', section: 'fulfillment', transform: parseDate },
  { csvColumn: 'Fulfillment Letter mailed', crmKey: 'fulfillment_letter_mailed', type: 'date', section: 'fulfillment', transform: parseDate },
  { csvColumn: 'Fulfillment Email Sent', crmKey: 'fulfillment_email_sent', type: 'date', section: 'fulfillment', transform: parseDate },
  { csvColumn: 'Complete Date', crmKey: 'complete_date', type: 'date', section: 'fulfillment', transform: parseDate },

  // Activity
  { csvColumn: 'Days Visited', crmKey: 'days_visited', type: 'number', section: 'activity', transform: parseNumber },
  { csvColumn: 'Average Time Spent (Minutes)', crmKey: 'average_time_spent_minutes', type: 'number', section: 'activity', transform: parseNumber },
  { csvColumn: 'Number Of Chats', crmKey: 'number_of_chats', type: 'number', section: 'activity', transform: parseNumber },
  { csvColumn: 'Most Recent Visit', crmKey: 'most_recent_visit', type: 'datetime', section: 'activity', transform: parseDateTime },
  { csvColumn: 'First Visit', crmKey: 'first_visit', type: 'datetime', section: 'activity', transform: parseDateTime },
  { csvColumn: 'First Page Visited', crmKey: 'first_page_visited', type: 'text', section: 'activity' },
  { csvColumn: 'Referrer', crmKey: 'referrer', type: 'text', section: 'activity' },
  { csvColumn: 'Visitor Score', crmKey: 'visitor_score', type: 'number', section: 'activity', transform: parseNumber },
  { csvColumn: 'Last Activity Time', crmKey: 'last_activity_time', type: 'datetime', section: 'activity', transform: parseDateTime },

  // Preferences
  { csvColumn: 'Email Opt Out', crmKey: 'email_opt_out', type: 'boolean', section: 'preferences', transform: parseBoolean },
  { csvColumn: 'Preferred Method of Communication', crmKey: 'preferred_method_of_communication', type: 'text', section: 'preferences' },
  { csvColumn: 'Unsubscribed Mode', crmKey: 'unsubscribed_mode', type: 'text', section: 'preferences' },
  { csvColumn: 'Unsubscribed Time', crmKey: 'unsubscribed_time', type: 'datetime', section: 'preferences', transform: parseDateTime },

  // Business
  { csvColumn: 'Business or Practice Name', crmKey: 'business_or_practice_name', type: 'text', section: 'business' },
  { csvColumn: 'DPC Name', crmKey: 'dpc_name', type: 'text', section: 'business' },
  { csvColumn: 'Household Annual Adj Gross', crmKey: 'household_annual_adj_gross', type: 'currency', section: 'business', transform: parseNumber },

  // System
  { csvColumn: 'Created By', crmKey: 'created_by_name', type: 'text', section: 'system' },
  { csvColumn: 'Modified By', crmKey: 'modified_by_name', type: 'text', section: 'system' },
  { csvColumn: 'Created Time', crmKey: 'zoho_created_time', type: 'datetime', section: 'system', transform: parseDateTime },
  { csvColumn: 'Modified Time', crmKey: 'zoho_modified_time', type: 'datetime', section: 'system', transform: parseDateTime },
  { csvColumn: 'Notes History', crmKey: 'notes_history', type: 'text', section: 'system' },
  { csvColumn: 'Locked', crmKey: 'locked', type: 'boolean', section: 'system', transform: parseBoolean },
  { csvColumn: 'Admin123', crmKey: 'admin123', type: 'text', section: 'system' },
  { csvColumn: 'Change Log Time', crmKey: 'change_log_time', type: 'datetime', section: 'system', transform: parseDateTime },
  { csvColumn: 'Last Enriched Time', crmKey: 'last_enriched_time', type: 'datetime', section: 'system', transform: parseDateTime },
  { csvColumn: 'Enrich Status', crmKey: 'enrich_status', type: 'text', section: 'system' },
  { csvColumn: 'Connected To.module', crmKey: 'connected_to_module', type: 'text', section: 'system' },
  { csvColumn: 'Connected To.id', crmKey: 'connected_to_id', type: 'text', section: 'system' },
];

/**
 * Create a mapping lookup by CSV column name
 */
export const MAPPING_BY_CSV_COLUMN = new Map<string, FieldMapping>(
  CONTACTS_FIELD_MAPPING.map(m => [m.csvColumn, m])
);

/**
 * Create a mapping lookup by CRM key
 */
export const MAPPING_BY_CRM_KEY = new Map<string, FieldMapping>(
  CONTACTS_FIELD_MAPPING.map(m => [m.crmKey, m])
);

/**
 * Transform a CSV row to CRM record data format
 */
export function transformCsvRowToRecord(row: Record<string, string>): {
  title: string;
  status: string;
  email: string | null;
  phone: string | null;
  data: Record<string, unknown>;
} {
  const data: Record<string, unknown> = {};
  
  for (const mapping of CONTACTS_FIELD_MAPPING) {
    const rawValue = row[mapping.csvColumn];
    if (rawValue !== undefined && rawValue !== null && rawValue !== '') {
      const value = mapping.transform ? mapping.transform(rawValue) : rawValue;
      if (value !== null && value !== undefined && value !== '') {
        data[mapping.crmKey] = value;
      }
    }
  }
  
  // Extract system fields
  const title = (row['Contact Name'] || `${row['First Name'] || ''} ${row['Last Name'] || ''}`.trim()) || 'Unknown';
  const status = row['Contact Status'] || 'Active';
  const email = row['Email'] || null;
  const phone = row['Phone'] || null;
  
  return { title, status, email, phone, data };
}

/**
 * Validate a CSV row for required fields
 */
export function validateCsvRow(row: Record<string, string>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Must have at least first name or contact name
  if (!row['First Name'] && !row['Contact Name']) {
    errors.push('Missing required field: First Name or Contact Name');
  }
  
  // Validate email format if present
  if (row['Email']) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(row['Email'])) {
      errors.push(`Invalid email format: ${row['Email']}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
