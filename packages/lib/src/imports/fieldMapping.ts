/**
 * Field Mapping Engine
 * 
 * Provides auto-detection of column types, fuzzy matching of source columns
 * to target database fields, and mapping configuration management.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, FieldMapping, Json } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export type EntityType = 'member' | 'advisor' | 'lead' | 'plan' | 'membership';
export type FieldType = 'text' | 'email' | 'phone' | 'date' | 'number' | 'boolean' | 'select';

export interface TargetColumn {
  column: string;
  label: string;
  required: boolean;
  type: FieldType;
}

export interface ColumnMapping {
  sourceColumn: string;
  targetColumn: string | null;
  confidence: number; // 0-1 score for auto-match confidence
  isAutoMatched: boolean;
}

export interface FieldMappingConfig {
  entityType: EntityType;
  sourceName: string;
  name: string;
  mappings: ColumnMapping[];
  sourceColumns: string[];
  targetColumns: TargetColumn[];
}

export interface DetectedColumnType {
  column: string;
  detectedType: FieldType;
  sampleValues: string[];
}

// ============================================================================
// COLUMN TYPE DETECTION
// ============================================================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[\d\s\-\+\(\)\.]{7,20}$/;
const DATE_REGEX = /^(\d{4}[-\/]\d{2}[-\/]\d{2}|\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})$/;
const NUMBER_REGEX = /^-?[\d,]+\.?\d*$/;
const BOOLEAN_VALUES = ['true', 'false', 'yes', 'no', '1', '0', 'y', 'n'];

/**
 * Detect the type of a column based on sample values
 */
export function detectColumnType(sampleValues: string[]): FieldType {
  const nonEmpty = sampleValues.filter(v => v && v.trim());
  if (nonEmpty.length === 0) return 'text';
  
  // Check for email
  const emailMatches = nonEmpty.filter(v => EMAIL_REGEX.test(v.trim()));
  if (emailMatches.length >= nonEmpty.length * 0.8) return 'email';
  
  // Check for phone
  const phoneMatches = nonEmpty.filter(v => PHONE_REGEX.test(v.replace(/[^\d\s\-\+\(\)\.]/g, '')));
  if (phoneMatches.length >= nonEmpty.length * 0.8) return 'phone';
  
  // Check for date
  const dateMatches = nonEmpty.filter(v => DATE_REGEX.test(v.trim()) || !isNaN(Date.parse(v)));
  if (dateMatches.length >= nonEmpty.length * 0.8) return 'date';
  
  // Check for boolean
  const boolMatches = nonEmpty.filter(v => BOOLEAN_VALUES.includes(v.toLowerCase().trim()));
  if (boolMatches.length >= nonEmpty.length * 0.8) return 'boolean';
  
  // Check for number
  const numberMatches = nonEmpty.filter(v => NUMBER_REGEX.test(v.replace(/[$€£,]/g, '').trim()));
  if (numberMatches.length >= nonEmpty.length * 0.8) return 'number';
  
  return 'text';
}

/**
 * Analyze CSV data to detect column types
 */
export function analyzeColumns(
  headers: string[],
  rows: Record<string, string>[]
): DetectedColumnType[] {
  return headers.map(header => {
    const sampleValues = rows.slice(0, 100).map(row => row[header] || '');
    return {
      column: header,
      detectedType: detectColumnType(sampleValues),
      sampleValues: sampleValues.slice(0, 5),
    };
  });
}

// ============================================================================
// TARGET COLUMNS BY ENTITY TYPE
// ============================================================================

export const TARGET_COLUMNS: Record<EntityType, TargetColumn[]> = {
  member: [
    { column: 'first_name', label: 'First Name', required: true, type: 'text' },
    { column: 'last_name', label: 'Last Name', required: true, type: 'text' },
    { column: 'email', label: 'Email', required: true, type: 'email' },
    { column: 'phone', label: 'Phone', required: false, type: 'phone' },
    { column: 'date_of_birth', label: 'Date of Birth', required: false, type: 'date' },
    { column: 'gender', label: 'Gender', required: false, type: 'text' },
    { column: 'address_line1', label: 'Address Line 1', required: false, type: 'text' },
    { column: 'address_line2', label: 'Address Line 2', required: false, type: 'text' },
    { column: 'city', label: 'City', required: false, type: 'text' },
    { column: 'state', label: 'State', required: false, type: 'text' },
    { column: 'postal_code', label: 'ZIP/Postal Code', required: false, type: 'text' },
    { column: 'member_number', label: 'Member Number', required: false, type: 'text' },
    { column: 'status', label: 'Status', required: false, type: 'select' },
    { column: 'plan_name', label: 'Plan Name', required: false, type: 'text' },
    { column: 'plan_type', label: 'Plan Type', required: false, type: 'text' },
    { column: 'effective_date', label: 'Effective Date', required: false, type: 'date' },
    { column: 'termination_date', label: 'Termination Date', required: false, type: 'date' },
    { column: 'monthly_share', label: 'Monthly Share', required: false, type: 'number' },
    { column: 'advisor_email', label: 'Advisor Email (for linking)', required: false, type: 'email' },
    { column: 'advisor_code', label: 'Advisor Code (for linking)', required: false, type: 'text' },
  ],
  advisor: [
    { column: 'first_name', label: 'First Name', required: true, type: 'text' },
    { column: 'last_name', label: 'Last Name', required: true, type: 'text' },
    { column: 'email', label: 'Email', required: true, type: 'email' },
    { column: 'phone', label: 'Phone', required: false, type: 'phone' },
    { column: 'agency_name', label: 'Agency Name', required: false, type: 'text' },
    { column: 'license_number', label: 'License Number', required: false, type: 'text' },
    { column: 'license_states', label: 'License States', required: false, type: 'text' },
    { column: 'npn', label: 'NPN', required: false, type: 'text' },
    { column: 'advisor_code', label: 'Advisor Code', required: false, type: 'text' },
    { column: 'status', label: 'Status', required: false, type: 'select' },
    { column: 'commission_tier', label: 'Commission Tier', required: false, type: 'text' },
    { column: 'parent_advisor_email', label: 'Parent Advisor Email', required: false, type: 'email' },
  ],
  lead: [
    { column: 'first_name', label: 'First Name', required: true, type: 'text' },
    { column: 'last_name', label: 'Last Name', required: true, type: 'text' },
    { column: 'email', label: 'Email', required: true, type: 'email' },
    { column: 'phone', label: 'Phone', required: false, type: 'phone' },
    { column: 'state', label: 'State', required: false, type: 'text' },
    { column: 'source', label: 'Lead Source', required: false, type: 'text' },
    { column: 'campaign', label: 'Campaign', required: false, type: 'text' },
    { column: 'status', label: 'Status', required: false, type: 'select' },
    { column: 'notes', label: 'Notes', required: false, type: 'text' },
    { column: 'household_size', label: 'Household Size', required: false, type: 'number' },
    { column: 'advisor_email', label: 'Advisor Email (for linking)', required: false, type: 'email' },
  ],
  plan: [
    { column: 'name', label: 'Plan Name', required: true, type: 'text' },
    { column: 'code', label: 'Plan Code', required: true, type: 'text' },
    { column: 'description', label: 'Description', required: false, type: 'text' },
    { column: 'product_line', label: 'Product Line', required: false, type: 'text' },
    { column: 'coverage_category', label: 'Coverage Category', required: false, type: 'text' },
    { column: 'network_type', label: 'Network Type', required: false, type: 'text' },
    { column: 'tier', label: 'Tier', required: false, type: 'text' },
    { column: 'monthly_share', label: 'Monthly Share', required: false, type: 'number' },
    { column: 'enrollment_fee', label: 'Enrollment Fee', required: false, type: 'number' },
    { column: 'iua_amount', label: 'IUA Amount', required: false, type: 'number' },
    { column: 'is_active', label: 'Is Active', required: false, type: 'boolean' },
  ],
  membership: [
    { column: 'member_email', label: 'Member Email (for linking)', required: true, type: 'email' },
    { column: 'member_number', label: 'Member Number (for linking)', required: false, type: 'text' },
    { column: 'plan_code', label: 'Plan Code (for linking)', required: true, type: 'text' },
    { column: 'membership_number', label: 'Membership Number', required: false, type: 'text' },
    { column: 'status', label: 'Status', required: false, type: 'select' },
    { column: 'effective_date', label: 'Effective Date', required: true, type: 'date' },
    { column: 'end_date', label: 'End Date', required: false, type: 'date' },
    { column: 'billing_amount', label: 'Billing Amount', required: false, type: 'number' },
    { column: 'advisor_email', label: 'Advisor Email (for linking)', required: false, type: 'email' },
  ],
};

// ============================================================================
// FUZZY MATCHING
// ============================================================================

/**
 * Common aliases for column names - used for fuzzy matching
 */
const COLUMN_ALIASES: Record<string, string[]> = {
  first_name: ['first_name', 'firstname', 'first name', 'fname', 'given_name', 'givenname', 'first'],
  last_name: ['last_name', 'lastname', 'last name', 'lname', 'surname', 'family_name', 'familyname', 'last'],
  email: ['email', 'email_address', 'emailaddress', 'e-mail', 'e_mail', 'mail'],
  phone: ['phone', 'phone_number', 'phonenumber', 'telephone', 'tel', 'mobile', 'cell', 'cell_phone', 'cellphone'],
  date_of_birth: ['date_of_birth', 'dateofbirth', 'dob', 'birthdate', 'birth_date', 'birthday'],
  address_line1: ['address_line1', 'address1', 'address', 'street', 'street_address', 'street1', 'mailing_address', 'address_1'],
  address_line2: ['address_line2', 'address2', 'apt', 'suite', 'unit', 'street2', 'address_2'],
  city: ['city', 'town', 'municipality'],
  state: ['state', 'province', 'region', 'st'],
  postal_code: ['postal_code', 'postalcode', 'zip', 'zip_code', 'zipcode', 'postcode', 'post_code'],
  member_number: ['member_number', 'membernumber', 'member_id', 'memberid', 'member_no', 'memberno', 'id_number'],
  status: ['status', 'member_status', 'account_status', 'state'],
  gender: ['gender', 'sex'],
  plan_name: ['plan_name', 'planname', 'plan', 'plan_type', 'coverage', 'product'],
  plan_type: ['plan_type', 'plantype', 'type', 'coverage_type'],
  effective_date: ['effective_date', 'effectivedate', 'start_date', 'startdate', 'enrollment_date', 'enrollmentdate', 'begin_date'],
  termination_date: ['termination_date', 'terminationdate', 'end_date', 'enddate', 'cancel_date', 'cancellation_date'],
  monthly_share: ['monthly_share', 'monthlyshare', 'monthly_amount', 'premium', 'monthly_premium', 'rate', 'monthly_rate'],
  license_number: ['license_number', 'licensenumber', 'license', 'lic_no', 'license_no'],
  license_states: ['license_states', 'licensestates', 'states', 'licensed_states'],
  agency_name: ['agency_name', 'agencyname', 'agency', 'company', 'company_name'],
  advisor_code: ['advisor_code', 'advisorcode', 'agent_code', 'agentcode', 'code', 'rep_code'],
  advisor_email: ['advisor_email', 'advisoremail', 'agent_email', 'agentemail', 'rep_email'],
  npn: ['npn', 'national_producer_number'],
  source: ['source', 'lead_source', 'leadsource', 'utm_source', 'referral_source'],
  campaign: ['campaign', 'utm_campaign', 'marketing_campaign'],
  notes: ['notes', 'note', 'comments', 'comment', 'remarks'],
  household_size: ['household_size', 'householdsize', 'family_size', 'familysize', 'hh_size'],
  name: ['name', 'plan_name', 'planname', 'title'],
  code: ['code', 'plan_code', 'plancode', 'product_code'],
  description: ['description', 'desc', 'details', 'summary'],
  product_line: ['product_line', 'productline', 'product', 'line'],
  coverage_category: ['coverage_category', 'coveragecategory', 'category', 'coverage_type'],
  network_type: ['network_type', 'networktype', 'network'],
  tier: ['tier', 'level', 'plan_tier'],
  enrollment_fee: ['enrollment_fee', 'enrollmentfee', 'signup_fee', 'application_fee'],
  iua_amount: ['iua_amount', 'iua', 'initial_unsharable_amount'],
  is_active: ['is_active', 'isactive', 'active', 'enabled'],
  member_email: ['member_email', 'memberemail', 'email', 'member_email_address'],
  plan_code: ['plan_code', 'plancode', 'plan_id', 'product_code'],
  membership_number: ['membership_number', 'membershipnumber', 'membership_id', 'account_number'],
  end_date: ['end_date', 'enddate', 'termination_date', 'cancel_date'],
  billing_amount: ['billing_amount', 'billingamount', 'amount', 'monthly_amount', 'charge'],
  commission_tier: ['commission_tier', 'commissiontier', 'comm_tier', 'tier', 'level'],
  parent_advisor_email: ['parent_advisor_email', 'parentadvisoremail', 'upline_email', 'uplineemail', 'manager_email'],
};

/**
 * Normalize a string for comparison (lowercase, remove special chars)
 */
function normalize(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

/**
 * Calculate similarity score between two strings (0-1)
 */
function similarity(a: string, b: string): number {
  const normalizedA = normalize(a);
  const normalizedB = normalize(b);
  
  if (normalizedA === normalizedB) return 1;
  
  const maxLen = Math.max(normalizedA.length, normalizedB.length);
  if (maxLen === 0) return 1;
  
  const distance = levenshteinDistance(normalizedA, normalizedB);
  return 1 - distance / maxLen;
}

/**
 * Auto-match source columns to target columns using fuzzy matching
 */
export function autoMatchColumns(
  sourceColumns: string[],
  targetColumns: TargetColumn[]
): ColumnMapping[] {
  const mappings: ColumnMapping[] = [];
  const usedTargets = new Set<string>();
  
  for (const source of sourceColumns) {
    let bestMatch: { target: string; confidence: number } | null = null;
    const normalizedSource = normalize(source);
    
    for (const target of targetColumns) {
      // Skip already used targets
      if (usedTargets.has(target.column)) continue;
      
      // Check direct alias match
      const aliases = COLUMN_ALIASES[target.column] || [target.column];
      for (const alias of aliases) {
        const aliasNormalized = normalize(alias);
        if (normalizedSource === aliasNormalized) {
          bestMatch = { target: target.column, confidence: 1 };
          break;
        }
        
        // Check if source contains alias or vice versa
        if (normalizedSource.includes(aliasNormalized) || aliasNormalized.includes(normalizedSource)) {
          const containScore = 0.85;
          if (!bestMatch || containScore > bestMatch.confidence) {
            bestMatch = { target: target.column, confidence: containScore };
          }
        }
      }
      
      if (bestMatch?.confidence === 1) break;
      
      // Fall back to fuzzy match on column name
      const score = similarity(source, target.column);
      if (score > 0.7 && (!bestMatch || score > bestMatch.confidence)) {
        bestMatch = { target: target.column, confidence: score };
      }
      
      // Also try matching against the label
      const labelScore = similarity(source, target.label);
      if (labelScore > 0.7 && (!bestMatch || labelScore > bestMatch.confidence)) {
        bestMatch = { target: target.column, confidence: labelScore };
      }
    }
    
    if (bestMatch && bestMatch.confidence >= 0.7) {
      usedTargets.add(bestMatch.target);
      mappings.push({
        sourceColumn: source,
        targetColumn: bestMatch.target,
        confidence: bestMatch.confidence,
        isAutoMatched: true,
      });
    } else {
      mappings.push({
        sourceColumn: source,
        targetColumn: null,
        confidence: 0,
        isAutoMatched: false,
      });
    }
  }
  
  return mappings;
}

// ============================================================================
// MAPPING PERSISTENCE
// ============================================================================

/**
 * Save a field mapping configuration to the database
 */
export async function saveFieldMapping(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  config: FieldMappingConfig
): Promise<{ data: FieldMapping | null; error: Error | null }> {
  // Convert mappings to simple object format for storage
  const mappingObject: Record<string, string> = {};
  for (const m of config.mappings) {
    if (m.targetColumn) {
      mappingObject[m.sourceColumn] = m.targetColumn;
    }
  }
  
  const { data, error } = await supabase
    .from('field_mappings')
    .upsert({
      organization_id: organizationId,
      entity_type: config.entityType,
      source_name: config.sourceName,
      name: config.name,
      mapping: mappingObject as unknown as Json,
      source_columns: config.sourceColumns as unknown as Json,
      target_columns: config.targetColumns as unknown as Json,
    }, {
      onConflict: 'organization_id,entity_type,source_name,name',
    })
    .select()
    .single();
  
  if (error) {
    return { data: null, error: new Error(error.message) };
  }
  
  return { data, error: null };
}

/**
 * Load a field mapping configuration from the database
 */
export async function loadFieldMapping(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  entityType: EntityType,
  sourceName: string
): Promise<{ data: FieldMappingConfig | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('field_mappings')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('entity_type', entityType)
    .eq('source_name', sourceName)
    .order('is_default', { ascending: false })
    .limit(1)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      // No rows found
      return { data: null, error: null };
    }
    return { data: null, error: new Error(error.message) };
  }
  
  // Convert stored format back to ColumnMapping[]
  const mappingObject = data.mapping as unknown as Record<string, string>;
  const sourceColumns = data.source_columns as unknown as string[];
  const targetColumns = (data.target_columns as unknown as TargetColumn[]) || TARGET_COLUMNS[entityType];
  
  const mappings: ColumnMapping[] = sourceColumns.map(source => ({
    sourceColumn: source,
    targetColumn: mappingObject[source] || null,
    confidence: mappingObject[source] ? 1 : 0,
    isAutoMatched: false,
  }));
  
  return {
    data: {
      entityType: data.entity_type as EntityType,
      sourceName: data.source_name,
      name: data.name,
      mappings,
      sourceColumns,
      targetColumns,
    },
    error: null,
  };
}

/**
 * List all saved field mappings for an organization
 */
export async function listFieldMappings(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  entityType?: EntityType
): Promise<{ data: FieldMapping[]; error: Error | null }> {
  let query = supabase
    .from('field_mappings')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });
  
  if (entityType) {
    query = query.eq('entity_type', entityType);
  }
  
  const { data, error } = await query;
  
  if (error) {
    return { data: [], error: new Error(error.message) };
  }
  
  return { data: data || [], error: null };
}

/**
 * Delete a field mapping
 */
export async function deleteFieldMapping(
  supabase: SupabaseClient<Database>,
  mappingId: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('field_mappings')
    .delete()
    .eq('id', mappingId);
  
  if (error) {
    return { error: new Error(error.message) };
  }
  
  return { error: null };
}

// ============================================================================
// APPLY MAPPING
// ============================================================================

/**
 * Apply a field mapping to a row of data
 */
export function applyMapping(
  row: Record<string, string>,
  mappings: ColumnMapping[]
): Record<string, string> {
  const result: Record<string, string> = {};
  
  for (const mapping of mappings) {
    if (mapping.targetColumn && row[mapping.sourceColumn] !== undefined) {
      result[mapping.targetColumn] = row[mapping.sourceColumn];
    }
  }
  
  return result;
}

/**
 * Convert ColumnMapping[] to simple mapping object
 */
export function mappingsToObject(mappings: ColumnMapping[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const m of mappings) {
    if (m.targetColumn) {
      result[m.sourceColumn] = m.targetColumn;
    }
  }
  return result;
}

/**
 * Convert simple mapping object to ColumnMapping[]
 */
export function objectToMappings(
  obj: Record<string, string>,
  sourceColumns: string[]
): ColumnMapping[] {
  return sourceColumns.map(source => ({
    sourceColumn: source,
    targetColumn: obj[source] || null,
    confidence: obj[source] ? 1 : 0,
    isAutoMatched: false,
  }));
}
