/**
 * CRM Communications - Merge Fields Engine
 * Safe template rendering with {{field}} syntax
 */

import type { MergeFieldContext } from './types';

// ============================================================================
// Merge Field Patterns
// ============================================================================

// Matches {{namespace.field}} or {{namespace.nested.field}}
const MERGE_FIELD_REGEX = /\{\{([a-zA-Z_][a-zA-Z0-9_.]*)\}\}/g;

// Maximum template length to prevent DoS
const MAX_TEMPLATE_LENGTH = 50000;

// Maximum depth for nested field access
const MAX_FIELD_DEPTH = 5;

// ============================================================================
// Field Value Resolution
// ============================================================================

/**
 * Safely get a nested value from an object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  
  if (parts.length > MAX_FIELD_DEPTH) {
    return undefined;
  }
  
  let current: unknown = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    
    if (typeof current !== 'object') {
      return undefined;
    }
    
    current = (current as Record<string, unknown>)[part];
  }
  
  return current;
}

/**
 * Format a value for display in a template
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  if (typeof value === 'string') {
    return value;
  }
  
  if (typeof value === 'number') {
    return String(value);
  }
  
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  
  if (value instanceof Date) {
    return value.toLocaleDateString();
  }
  
  if (Array.isArray(value)) {
    return value.map(v => formatValue(v)).join(', ');
  }
  
  if (typeof value === 'object') {
    // Don't render complex objects
    return '';
  }
  
  return String(value);
}

/**
 * Resolve a merge field path to its value
 */
function resolveMergeField(fieldPath: string, context: MergeFieldContext): string {
  const parts = fieldPath.split('.');
  
  if (parts.length < 2) {
    return '';
  }
  
  const namespace = parts[0];
  const remainingPath = parts.slice(1).join('.');
  
  let sourceObject: Record<string, unknown> | undefined;
  
  switch (namespace) {
    case 'system':
      sourceObject = context.system as Record<string, unknown>;
      break;
    case 'record':
      sourceObject = context.record;
      break;
    case 'data':
      sourceObject = context.data;
      break;
    case 'owner':
      sourceObject = context.owner as Record<string, unknown> | undefined;
      break;
    case 'member':
      sourceObject = context.member as Record<string, unknown> | undefined;
      break;
    case 'custom':
      sourceObject = context.custom;
      break;
    default:
      // Try to find in record.data as fallback
      sourceObject = context.data;
      return formatValue(getNestedValue(sourceObject || {}, fieldPath));
  }
  
  if (!sourceObject) {
    return '';
  }
  
  const value = getNestedValue(sourceObject, remainingPath);
  return formatValue(value);
}

// ============================================================================
// Template Rendering
// ============================================================================

/**
 * Render a template with merge fields replaced by values
 * 
 * @param template - Template string with {{field}} placeholders
 * @param context - Context object with field values
 * @returns Rendered template with all merge fields replaced
 */
export function renderTemplate(
  template: string,
  context: MergeFieldContext
): string {
  if (!template) {
    return '';
  }
  
  // Security: Limit template length
  if (template.length > MAX_TEMPLATE_LENGTH) {
    throw new Error(`Template exceeds maximum length of ${MAX_TEMPLATE_LENGTH} characters`);
  }
  
  // Replace all merge fields
  return template.replace(MERGE_FIELD_REGEX, (match, fieldPath) => {
    try {
      return resolveMergeField(fieldPath, context);
    } catch {
      // If resolution fails, return empty string (safe default)
      return '';
    }
  });
}

/**
 * Extract all merge field paths from a template
 * 
 * @param template - Template string with {{field}} placeholders
 * @returns Array of unique field paths
 */
export function extractMergeFields(template: string): string[] {
  if (!template) {
    return [];
  }
  
  const matches = template.matchAll(MERGE_FIELD_REGEX);
  const fields = new Set<string>();
  
  for (const match of matches) {
    fields.add(match[1]);
  }
  
  return Array.from(fields);
}

/**
 * Validate merge fields in a template against available context
 * 
 * @param template - Template string with {{field}} placeholders
 * @param context - Context object with field values
 * @returns Object with valid and invalid field paths
 */
export function validateMergeFields(
  template: string,
  context: MergeFieldContext
): { valid: string[]; invalid: string[] } {
  const fields = extractMergeFields(template);
  const valid: string[] = [];
  const invalid: string[] = [];
  
  for (const field of fields) {
    const value = resolveMergeField(field, context);
    if (value !== '') {
      valid.push(field);
    } else {
      invalid.push(field);
    }
  }
  
  return { valid, invalid };
}

// ============================================================================
// Context Building
// ============================================================================

/**
 * Build a default system context with common values
 */
export function buildSystemContext(): MergeFieldContext['system'] {
  const now = new Date();
  
  return {
    date: now.toLocaleDateString(),
    time: now.toLocaleTimeString(),
    datetime: now.toLocaleString(),
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1).padStart(2, '0'),
    day: String(now.getDate()).padStart(2, '0'),
  };
}

/**
 * Build a complete merge field context from a CRM record
 */
export function buildMergeContext(
  record: Record<string, unknown>,
  options?: {
    orgName?: string;
    orgId?: string;
    owner?: MergeFieldContext['owner'];
    member?: MergeFieldContext['member'];
    custom?: Record<string, unknown>;
  }
): MergeFieldContext {
  const systemContext = buildSystemContext();
  
  return {
    system: {
      ...systemContext,
      org_name: options?.orgName,
      org_id: options?.orgId,
    },
    record: {
      id: record.id,
      title: record.title,
      status: record.status,
      stage: record.stage,
      email: record.email,
      phone: record.phone,
      created_at: record.created_at,
      updated_at: record.updated_at,
    },
    data: (record.data as Record<string, unknown>) || {},
    owner: options?.owner,
    member: options?.member,
    custom: options?.custom,
  };
}

// ============================================================================
// SMS-Specific Utilities
// ============================================================================

const SMS_SEGMENT_LENGTH = 160;
const SMS_EXTENDED_SEGMENT_LENGTH = 153; // When concatenation headers needed

/**
 * Check if SMS content exceeds single segment length
 */
export function checkSmsLength(content: string): {
  length: number;
  segments: number;
  warning: boolean;
} {
  const length = content.length;
  
  if (length <= SMS_SEGMENT_LENGTH) {
    return { length, segments: 1, warning: false };
  }
  
  // For multi-segment SMS
  const segments = Math.ceil(length / SMS_EXTENDED_SEGMENT_LENGTH);
  
  return {
    length,
    segments,
    warning: segments > 2, // Warn if more than 2 segments (expensive)
  };
}

/**
 * Truncate SMS content to fit within segment limit
 */
export function truncateSms(content: string, maxSegments: number = 2): string {
  const maxLength = maxSegments === 1 
    ? SMS_SEGMENT_LENGTH 
    : SMS_EXTENDED_SEGMENT_LENGTH * maxSegments;
  
  if (content.length <= maxLength) {
    return content;
  }
  
  return content.substring(0, maxLength - 3) + '...';
}

// ============================================================================
// Preview Generation
// ============================================================================

/**
 * Generate a preview of rendered template with sample data
 */
export function generatePreview(
  template: string,
  sampleData?: Partial<MergeFieldContext>
): string {
  const defaultSampleContext: MergeFieldContext = {
    system: buildSystemContext(),
    record: {
      id: 'sample-id',
      title: 'John Doe',
      email: 'john.doe@example.com',
      phone: '(555) 123-4567',
    },
    data: {
      first_name: 'John',
      last_name: 'Doe',
      company: 'Acme Corp',
      city: 'San Francisco',
      state: 'CA',
    },
    owner: {
      name: 'Jane Smith',
      email: 'jane.smith@company.com',
    },
  };
  
  const context: MergeFieldContext = {
    ...defaultSampleContext,
    ...sampleData,
    system: { ...defaultSampleContext.system, ...sampleData?.system },
    record: { ...defaultSampleContext.record, ...sampleData?.record },
    data: { ...defaultSampleContext.data, ...sampleData?.data },
  };
  
  return renderTemplate(template, context);
}
