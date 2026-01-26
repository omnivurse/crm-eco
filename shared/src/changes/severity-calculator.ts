/**
 * Change Intelligence System - Severity Calculator
 * Rules-based system for determining change severity
 */

import type { ChangeSeverity } from './types';

/**
 * Severity rule definition
 */
interface SeverityRule {
  name: string;
  condition: (input: SeverityInput) => boolean;
  severity: ChangeSeverity;
  requiresReview?: boolean;
}

/**
 * Input for severity calculation
 */
export interface SeverityInput {
  changeType: string;
  entityType: string;
  diff?: Record<string, { from: unknown; to: unknown }>;
  payload?: Record<string, unknown>;
  sourceType?: string;
}

/**
 * Severity calculation result
 */
export interface SeverityResult {
  severity: ChangeSeverity;
  requiresReview: boolean;
  matchedRule?: string;
}

// Sensitive fields that may indicate higher severity
const SENSITIVE_FIELDS = [
  'status',
  'stage',
  'amount',
  'price',
  'termination_date',
  'effective_date',
  'owner_id',
  'assigned_to',
  'role',
  'permissions',
  'plan_id',
  'billing_status',
];

// High-risk status values
const HIGH_RISK_STATUS_VALUES = [
  'inactive',
  'terminated',
  'cancelled',
  'suspended',
  'failed',
  'error',
];

/**
 * Severity rules in priority order (first match wins)
 */
const SEVERITY_RULES: SeverityRule[] = [
  // Critical rules
  {
    name: 'termination',
    condition: (i) => i.changeType === 'termination' || i.changeType.includes('terminate'),
    severity: 'critical',
    requiresReview: true,
  },
  {
    name: 'integration_error',
    condition: (i) => i.changeType === 'integration_error' || i.changeType.includes('error'),
    severity: 'critical',
    requiresReview: true,
  },
  {
    name: 'security_change',
    condition: (i) =>
      i.entityType === 'permission' ||
      i.entityType === 'role' ||
      Boolean(i.diff && Object.keys(i.diff).some((k) => k.includes('permission') || k.includes('role'))),
    severity: 'critical',
    requiresReview: true,
  },

  // High rules
  {
    name: 'plan_change',
    condition: (i) => i.changeType === 'plan_change' || i.changeType.includes('plan'),
    severity: 'high',
    requiresReview: true,
  },
  {
    name: 'sync_conflict',
    condition: (i) => i.changeType === 'sync_conflict' || i.changeType.includes('conflict'),
    severity: 'high',
    requiresReview: true,
  },
  {
    name: 'status_inactive',
    condition: (i) => {
      if (!i.diff?.status) return false;
      const newStatus = String(i.diff.status.to).toLowerCase();
      return HIGH_RISK_STATUS_VALUES.some((v) => newStatus.includes(v));
    },
    severity: 'high',
    requiresReview: true,
  },
  {
    name: 'significant_amount_change',
    condition: (i) => {
      if (!i.diff?.amount && !i.diff?.price) return false;
      const field = i.diff.amount || i.diff.price;
      if (!field) return false;
      const before = Number(field.from) || 0;
      const after = Number(field.to) || 0;
      if (before === 0) return after > 1000;
      const percentChange = Math.abs((after - before) / before);
      return percentChange > 0.25; // >25% change
    },
    severity: 'high',
    requiresReview: false,
  },
  {
    name: 'ownership_change',
    condition: (i) =>
      Boolean(i.diff &&
      Object.keys(i.diff).some((k) => k === 'owner_id' || k === 'assigned_to' || k.includes('owner'))),
    severity: 'high',
    requiresReview: false,
  },

  // Medium rules
  {
    name: 'enrollment_new',
    condition: (i) =>
      (i.entityType === 'enrollment' && i.changeType === 'create') ||
      i.changeType === 'enrollment',
    severity: 'medium',
    requiresReview: false,
  },
  {
    name: 'member_new',
    condition: (i) => i.entityType === 'member' && i.changeType === 'create',
    severity: 'medium',
    requiresReview: false,
  },
  {
    name: 'deal_stage_change',
    condition: (i) =>
      i.entityType === 'deal' && (i.changeType === 'stage_change' || Boolean(i.diff?.stage)),
    severity: 'medium',
    requiresReview: false,
  },
  {
    name: 'status_change',
    condition: (i) => i.changeType === 'status_change' || Boolean(i.diff?.status),
    severity: 'medium',
    requiresReview: false,
  },
  {
    name: 'sensitive_field_change',
    condition: (i) =>
      Boolean(i.diff && Object.keys(i.diff).some((k) => SENSITIVE_FIELDS.includes(k))),
    severity: 'medium',
    requiresReview: false,
  },

  // Low rules
  {
    name: 'record_create',
    condition: (i) => i.changeType === 'create',
    severity: 'low',
    requiresReview: false,
  },
  {
    name: 'record_delete',
    condition: (i) => i.changeType === 'delete',
    severity: 'low',
    requiresReview: false,
  },
  {
    name: 'assignment',
    condition: (i) => i.changeType === 'assignment',
    severity: 'low',
    requiresReview: false,
  },

  // Default - info
  {
    name: 'default',
    condition: () => true,
    severity: 'info',
    requiresReview: false,
  },
];

/**
 * Calculate severity for a change event
 * @param input - Change details for severity calculation
 * @returns Severity result with matched rule
 */
export function calculateSeverity(input: SeverityInput): SeverityResult {
  for (const rule of SEVERITY_RULES) {
    if (rule.condition(input)) {
      return {
        severity: rule.severity,
        requiresReview: rule.requiresReview ?? false,
        matchedRule: rule.name,
      };
    }
  }

  // Fallback (should never reach due to default rule)
  return {
    severity: 'info',
    requiresReview: false,
  };
}

/**
 * Check if a change should require review based on severity and type
 * @param severity - The calculated severity
 * @param changeType - The type of change
 * @returns Whether review is required
 */
export function shouldRequireReview(severity: ChangeSeverity, changeType: string): boolean {
  // Critical always requires review
  if (severity === 'critical') return true;

  // Specific change types always require review
  const reviewRequired = [
    'termination',
    'plan_change',
    'sync_conflict',
    'security_change',
    'role_change',
    'permission_change',
  ];

  return reviewRequired.some((type) => changeType.includes(type));
}

/**
 * Get severity from a string value (with validation)
 * @param value - String value to convert
 * @returns Valid severity or 'info' default
 */
export function parseSeverity(value: string | undefined | null): ChangeSeverity {
  const validSeverities: ChangeSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];
  if (value && validSeverities.includes(value as ChangeSeverity)) {
    return value as ChangeSeverity;
  }
  return 'info';
}
