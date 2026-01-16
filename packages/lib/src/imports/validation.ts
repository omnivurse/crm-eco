/**
 * Validation Engine
 * 
 * Provides field-level validation, referential integrity checks,
 * and duplicate detection for import data.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types';
import { parseDate, parseNumber } from './normalize';
import type { EntityType, TargetColumn } from './fieldMapping';
import { TARGET_COLUMNS } from './fieldMapping';

// ============================================================================
// TYPES
// ============================================================================

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
  value?: string;
}

export interface RowValidationResult {
  rowIndex: number;
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  matchType: 'new' | 'exact_match' | 'fuzzy_match' | 'duplicate' | null;
  existingEntityId: string | null;
  linkedEntities: Record<string, string | null>; // e.g., { advisor_id: 'uuid' }
}

export interface BatchValidationResult {
  totalRows: number;
  validRows: number;
  errorRows: number;
  warningRows: number;
  rows: RowValidationResult[];
  summary: {
    missingRequired: number;
    invalidFormat: number;
    duplicates: number;
    orphaned: number; // rows with unresolved references
  };
}

export interface ValidationContext {
  supabase: SupabaseClient<Database>;
  organizationId: string;
  entityType: EntityType;
  duplicateStrategy: 'skip' | 'update' | 'error';
  isIncremental: boolean;
}

// ============================================================================
// FIELD VALIDATORS
// ============================================================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[\d\s\-\+\(\)\.]{7,20}$/;

/**
 * Validate a single field value based on its type
 */
export function validateField(
  value: string | undefined | null,
  column: TargetColumn
): ValidationError | null {
  const trimmedValue = value?.trim() || '';
  
  // Required check
  if (column.required && !trimmedValue) {
    return {
      field: column.column,
      message: `${column.label} is required`,
      severity: 'error',
    };
  }
  
  // Empty optional fields are OK
  if (!trimmedValue) return null;
  
  // Type-specific validation
  switch (column.type) {
    case 'email':
      if (!EMAIL_REGEX.test(trimmedValue)) {
        return {
          field: column.column,
          message: `${column.label} is not a valid email address`,
          severity: 'error',
          value: trimmedValue,
        };
      }
      break;
      
    case 'phone':
      // More lenient phone validation - just check it has enough digits
      const digits = trimmedValue.replace(/\D/g, '');
      if (digits.length < 7 || digits.length > 15) {
        return {
          field: column.column,
          message: `${column.label} should be a valid phone number`,
          severity: 'warning',
          value: trimmedValue,
        };
      }
      break;
      
    case 'date':
      const parsedDate = parseDate(trimmedValue);
      if (!parsedDate) {
        return {
          field: column.column,
          message: `${column.label} is not a valid date format`,
          severity: 'error',
          value: trimmedValue,
        };
      }
      break;
      
    case 'number':
      const parsedNumber = parseNumber(trimmedValue);
      if (parsedNumber === null) {
        return {
          field: column.column,
          message: `${column.label} is not a valid number`,
          severity: 'error',
          value: trimmedValue,
        };
      }
      break;
      
    case 'boolean':
      const boolValues = ['true', 'false', 'yes', 'no', '1', '0', 'y', 'n'];
      if (!boolValues.includes(trimmedValue.toLowerCase())) {
        return {
          field: column.column,
          message: `${column.label} should be yes/no, true/false, or 1/0`,
          severity: 'warning',
          value: trimmedValue,
        };
      }
      break;
  }
  
  return null;
}

/**
 * Validate all fields in a row
 */
export function validateRow(
  row: Record<string, string>,
  entityType: EntityType
): { errors: ValidationError[]; warnings: ValidationError[] } {
  const targetColumns = TARGET_COLUMNS[entityType];
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  
  for (const column of targetColumns) {
    const error = validateField(row[column.column], column);
    if (error) {
      if (error.severity === 'error') {
        errors.push(error);
      } else {
        warnings.push(error);
      }
    }
  }
  
  return { errors, warnings };
}

// ============================================================================
// DUPLICATE DETECTION
// ============================================================================

interface ExistingEntity {
  id: string;
  email?: string;
  member_number?: string;
  date_of_birth?: string;
  advisor_code?: string;
  code?: string; // for plans
  membership_number?: string;
}

/**
 * Find existing members by various match criteria
 */
async function findExistingMembers(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  emails: string[],
  memberNumbers: string[]
): Promise<Map<string, ExistingEntity>> {
  const result = new Map<string, ExistingEntity>();
  
  // Find by email
  if (emails.length > 0) {
    const { data } = await supabase
      .from('members')
      .select('id, email, member_number, date_of_birth')
      .eq('organization_id', organizationId)
      .in('email', emails.map(e => e.toLowerCase()));
    
    if (data) {
      for (const row of data) {
        result.set(`email:${row.email?.toLowerCase()}`, row as ExistingEntity);
        if (row.member_number) {
          result.set(`member_number:${row.member_number}`, row as ExistingEntity);
        }
      }
    }
  }
  
  // Find by member number
  if (memberNumbers.length > 0) {
    const { data } = await supabase
      .from('members')
      .select('id, email, member_number, date_of_birth')
      .eq('organization_id', organizationId)
      .in('member_number', memberNumbers);
    
    if (data) {
      for (const row of data) {
        result.set(`member_number:${row.member_number}`, row as ExistingEntity);
        if (row.email) {
          result.set(`email:${row.email.toLowerCase()}`, row as ExistingEntity);
        }
      }
    }
  }
  
  return result;
}

/**
 * Find existing advisors by email or advisor code
 */
async function findExistingAdvisors(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  emails: string[],
  advisorCodes: string[]
): Promise<Map<string, ExistingEntity>> {
  const result = new Map<string, ExistingEntity>();
  
  if (emails.length > 0) {
    const { data } = await supabase
      .from('advisors')
      .select('id, email, advisor_code')
      .eq('organization_id', organizationId)
      .in('email', emails.map(e => e.toLowerCase()));
    
    if (data) {
      for (const row of data) {
        result.set(`email:${row.email?.toLowerCase()}`, row as ExistingEntity);
        if (row.advisor_code) {
          result.set(`advisor_code:${row.advisor_code}`, row as ExistingEntity);
        }
      }
    }
  }
  
  if (advisorCodes.length > 0) {
    const { data } = await supabase
      .from('advisors')
      .select('id, email, advisor_code')
      .eq('organization_id', organizationId)
      .in('advisor_code', advisorCodes);
    
    if (data) {
      for (const row of data) {
        result.set(`advisor_code:${row.advisor_code}`, row as ExistingEntity);
        if (row.email) {
          result.set(`email:${row.email.toLowerCase()}`, row as ExistingEntity);
        }
      }
    }
  }
  
  return result;
}

/**
 * Find existing leads by email
 */
async function findExistingLeads(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  emails: string[]
): Promise<Map<string, ExistingEntity>> {
  const result = new Map<string, ExistingEntity>();
  
  if (emails.length > 0) {
    const { data } = await supabase
      .from('leads')
      .select('id, email')
      .eq('organization_id', organizationId)
      .in('email', emails.map(e => e.toLowerCase()));
    
    if (data) {
      for (const row of data) {
        result.set(`email:${row.email?.toLowerCase()}`, row as ExistingEntity);
      }
    }
  }
  
  return result;
}

/**
 * Find existing plans by code
 */
async function findExistingPlans(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  codes: string[]
): Promise<Map<string, ExistingEntity>> {
  const result = new Map<string, ExistingEntity>();
  
  if (codes.length > 0) {
    const { data } = await supabase
      .from('plans')
      .select('id, code')
      .eq('organization_id', organizationId)
      .in('code', codes);
    
    if (data) {
      for (const row of data) {
        result.set(`code:${row.code}`, row as ExistingEntity);
      }
    }
  }
  
  return result;
}

// ============================================================================
// REFERENTIAL INTEGRITY
// ============================================================================

/**
 * Resolve advisor references (for member/lead imports)
 */
async function resolveAdvisorReferences(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  advisorEmails: string[],
  advisorCodes: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  
  if (advisorEmails.length > 0) {
    const { data } = await supabase
      .from('advisors')
      .select('id, email')
      .eq('organization_id', organizationId)
      .in('email', advisorEmails.map(e => e.toLowerCase()));
    
    if (data) {
      for (const row of data) {
        result.set(`email:${row.email?.toLowerCase()}`, row.id);
      }
    }
  }
  
  if (advisorCodes.length > 0) {
    const { data } = await supabase
      .from('advisors')
      .select('id, advisor_code')
      .eq('organization_id', organizationId)
      .in('advisor_code', advisorCodes);
    
    if (data) {
      for (const row of data) {
        if (row.advisor_code) {
          result.set(`code:${row.advisor_code}`, row.id);
        }
      }
    }
  }
  
  return result;
}

/**
 * Resolve member references (for membership imports)
 */
async function resolveMemberReferences(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  memberEmails: string[],
  memberNumbers: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  
  if (memberEmails.length > 0) {
    const { data } = await supabase
      .from('members')
      .select('id, email')
      .eq('organization_id', organizationId)
      .in('email', memberEmails.map(e => e.toLowerCase()));
    
    if (data) {
      for (const row of data) {
        result.set(`email:${row.email?.toLowerCase()}`, row.id);
      }
    }
  }
  
  if (memberNumbers.length > 0) {
    const { data } = await supabase
      .from('members')
      .select('id, member_number')
      .eq('organization_id', organizationId)
      .in('member_number', memberNumbers);
    
    if (data) {
      for (const row of data) {
        if (row.member_number) {
          result.set(`number:${row.member_number}`, row.id);
        }
      }
    }
  }
  
  return result;
}

/**
 * Resolve plan references (for membership imports)
 */
async function resolvePlanReferences(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  planCodes: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  
  if (planCodes.length > 0) {
    const { data } = await supabase
      .from('plans')
      .select('id, code')
      .eq('organization_id', organizationId)
      .in('code', planCodes);
    
    if (data) {
      for (const row of data) {
        result.set(`code:${row.code}`, row.id);
      }
    }
  }
  
  return result;
}

// ============================================================================
// BATCH VALIDATION
// ============================================================================

/**
 * Validate a batch of rows for import
 */
export async function validateBatch(
  context: ValidationContext,
  rows: Array<{ index: number; data: Record<string, string> }>
): Promise<BatchValidationResult> {
  const { supabase, organizationId, entityType, duplicateStrategy } = context;
  const results: RowValidationResult[] = [];
  
  // Collect values for batch lookups
  const emails: string[] = [];
  const memberNumbers: string[] = [];
  const advisorCodes: string[] = [];
  const advisorEmails: string[] = [];
  const planCodes: string[] = [];
  
  for (const row of rows) {
    if (row.data.email) emails.push(row.data.email.toLowerCase());
    if (row.data.member_email) emails.push(row.data.member_email.toLowerCase());
    if (row.data.member_number) memberNumbers.push(row.data.member_number);
    if (row.data.advisor_code) advisorCodes.push(row.data.advisor_code);
    if (row.data.advisor_email) advisorEmails.push(row.data.advisor_email.toLowerCase());
    if (row.data.code) planCodes.push(row.data.code);
    if (row.data.plan_code) planCodes.push(row.data.plan_code);
  }
  
  // Batch fetch existing entities
  let existingEntities: Map<string, ExistingEntity> = new Map();
  let advisorRefs: Map<string, string> = new Map();
  let memberRefs: Map<string, string> = new Map();
  let planRefs: Map<string, string> = new Map();
  
  switch (entityType) {
    case 'member':
      existingEntities = await findExistingMembers(supabase, organizationId, emails, memberNumbers);
      advisorRefs = await resolveAdvisorReferences(supabase, organizationId, advisorEmails, advisorCodes);
      break;
    case 'advisor':
      existingEntities = await findExistingAdvisors(supabase, organizationId, emails, advisorCodes);
      break;
    case 'lead':
      existingEntities = await findExistingLeads(supabase, organizationId, emails);
      advisorRefs = await resolveAdvisorReferences(supabase, organizationId, advisorEmails, advisorCodes);
      break;
    case 'plan':
      existingEntities = await findExistingPlans(supabase, organizationId, planCodes);
      break;
    case 'membership':
      memberRefs = await resolveMemberReferences(supabase, organizationId, emails, memberNumbers);
      planRefs = await resolvePlanReferences(supabase, organizationId, planCodes);
      break;
  }
  
  // Validate each row
  let summary = {
    missingRequired: 0,
    invalidFormat: 0,
    duplicates: 0,
    orphaned: 0,
  };
  
  for (const row of rows) {
    const { errors, warnings } = validateRow(row.data, entityType);
    
    // Check for duplicates
    let matchType: RowValidationResult['matchType'] = 'new';
    let existingEntityId: string | null = null;
    
    // Find existing entity based on entity type
    if (entityType === 'member') {
      const emailMatch = existingEntities.get(`email:${row.data.email?.toLowerCase()}`);
      const numberMatch = row.data.member_number ? existingEntities.get(`member_number:${row.data.member_number}`) : null;
      
      if (numberMatch) {
        matchType = 'exact_match';
        existingEntityId = numberMatch.id;
      } else if (emailMatch) {
        matchType = 'fuzzy_match';
        existingEntityId = emailMatch.id;
      }
    } else if (entityType === 'advisor') {
      const emailMatch = existingEntities.get(`email:${row.data.email?.toLowerCase()}`);
      const codeMatch = row.data.advisor_code ? existingEntities.get(`advisor_code:${row.data.advisor_code}`) : null;
      
      if (codeMatch) {
        matchType = 'exact_match';
        existingEntityId = codeMatch.id;
      } else if (emailMatch) {
        matchType = 'fuzzy_match';
        existingEntityId = emailMatch.id;
      }
    } else if (entityType === 'lead') {
      const emailMatch = existingEntities.get(`email:${row.data.email?.toLowerCase()}`);
      if (emailMatch) {
        matchType = 'exact_match';
        existingEntityId = emailMatch.id;
      }
    } else if (entityType === 'plan') {
      const codeMatch = row.data.code ? existingEntities.get(`code:${row.data.code}`) : null;
      if (codeMatch) {
        matchType = 'exact_match';
        existingEntityId = codeMatch.id;
      }
    }
    
    // Handle duplicate based on strategy
    if (existingEntityId && duplicateStrategy === 'error') {
      errors.push({
        field: 'email',
        message: `Duplicate record found (ID: ${existingEntityId})`,
        severity: 'error',
      });
      matchType = 'duplicate';
      summary.duplicates++;
    } else if (existingEntityId) {
      summary.duplicates++;
    }
    
    // Check referential integrity
    const linkedEntities: Record<string, string | null> = {};
    
    if (entityType === 'member' || entityType === 'lead') {
      // Try to resolve advisor
      if (row.data.advisor_email) {
        const advisorId = advisorRefs.get(`email:${row.data.advisor_email.toLowerCase()}`);
        linkedEntities.advisor_id = advisorId || null;
        if (!advisorId) {
          warnings.push({
            field: 'advisor_email',
            message: `Advisor not found: ${row.data.advisor_email}`,
            severity: 'warning',
            value: row.data.advisor_email,
          });
          summary.orphaned++;
        }
      } else if (row.data.advisor_code) {
        const advisorId = advisorRefs.get(`code:${row.data.advisor_code}`);
        linkedEntities.advisor_id = advisorId || null;
        if (!advisorId) {
          warnings.push({
            field: 'advisor_code',
            message: `Advisor not found: ${row.data.advisor_code}`,
            severity: 'warning',
            value: row.data.advisor_code,
          });
          summary.orphaned++;
        }
      }
    }
    
    if (entityType === 'membership') {
      // Resolve member
      if (row.data.member_email) {
        const memberId = memberRefs.get(`email:${row.data.member_email.toLowerCase()}`);
        linkedEntities.member_id = memberId || null;
        if (!memberId) {
          errors.push({
            field: 'member_email',
            message: `Member not found: ${row.data.member_email}`,
            severity: 'error',
            value: row.data.member_email,
          });
          summary.orphaned++;
        }
      } else if (row.data.member_number) {
        const memberId = memberRefs.get(`number:${row.data.member_number}`);
        linkedEntities.member_id = memberId || null;
        if (!memberId) {
          errors.push({
            field: 'member_number',
            message: `Member not found: ${row.data.member_number}`,
            severity: 'error',
            value: row.data.member_number,
          });
          summary.orphaned++;
        }
      }
      
      // Resolve plan
      if (row.data.plan_code) {
        const planId = planRefs.get(`code:${row.data.plan_code}`);
        linkedEntities.plan_id = planId || null;
        if (!planId) {
          errors.push({
            field: 'plan_code',
            message: `Plan not found: ${row.data.plan_code}`,
            severity: 'error',
            value: row.data.plan_code,
          });
          summary.orphaned++;
        }
      }
    }
    
    // Update summary counts
    if (errors.some(e => e.message.includes('required'))) summary.missingRequired++;
    if (errors.some(e => e.message.includes('valid'))) summary.invalidFormat++;
    
    results.push({
      rowIndex: row.index,
      isValid: errors.length === 0,
      errors,
      warnings,
      matchType,
      existingEntityId,
      linkedEntities,
    });
  }
  
  const validRows = results.filter(r => r.isValid).length;
  const errorRows = results.filter(r => !r.isValid).length;
  const warningRows = results.filter(r => r.warnings.length > 0).length;
  
  return {
    totalRows: rows.length,
    validRows,
    errorRows,
    warningRows,
    rows: results,
    summary,
  };
}

/**
 * Quick validation check without database lookups (for preview)
 */
export function quickValidate(
  rows: Array<{ index: number; data: Record<string, string> }>,
  entityType: EntityType
): BatchValidationResult {
  const results: RowValidationResult[] = [];
  let summary = {
    missingRequired: 0,
    invalidFormat: 0,
    duplicates: 0,
    orphaned: 0,
  };
  
  // Track seen emails for in-batch duplicate detection
  const seenEmails = new Set<string>();
  const seenNumbers = new Set<string>();
  
  for (const row of rows) {
    const { errors, warnings } = validateRow(row.data, entityType);
    
    // Check for in-batch duplicates
    const email = row.data.email?.toLowerCase();
    const memberNumber = row.data.member_number;
    
    if (email && seenEmails.has(email)) {
      warnings.push({
        field: 'email',
        message: 'Duplicate email in import file',
        severity: 'warning',
        value: email,
      });
      summary.duplicates++;
    }
    if (email) seenEmails.add(email);
    
    if (memberNumber && seenNumbers.has(memberNumber)) {
      warnings.push({
        field: 'member_number',
        message: 'Duplicate member number in import file',
        severity: 'warning',
        value: memberNumber,
      });
    }
    if (memberNumber) seenNumbers.add(memberNumber);
    
    // Update summary
    if (errors.some(e => e.message.includes('required'))) summary.missingRequired++;
    if (errors.some(e => e.message.includes('valid'))) summary.invalidFormat++;
    
    results.push({
      rowIndex: row.index,
      isValid: errors.length === 0,
      errors,
      warnings,
      matchType: null,
      existingEntityId: null,
      linkedEntities: {},
    });
  }
  
  return {
    totalRows: rows.length,
    validRows: results.filter(r => r.isValid).length,
    errorRows: results.filter(r => !r.isValid).length,
    warningRows: results.filter(r => r.warnings.length > 0).length,
    rows: results,
    summary,
  };
}
