/**
 * Change Intelligence System - Display Formatters
 * Utilities for formatting change events for display
 */

import type { ChangeEvent, ChangeEventWithActor, ChangeSeverity, ChangeSource } from './types';
import {
  SEVERITY_CONFIG,
  SOURCE_CONFIG,
  SYNC_STATUS_CONFIG,
  CHANGE_TYPE_LABELS,
  ENTITY_ICONS,
} from './constants';

/**
 * Format a timestamp for display
 * @param timestamp - ISO timestamp string
 * @returns Formatted relative time string
 */
export function formatRelativeTime(timestamp: string | Date): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 10) return 'just now';
  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

/**
 * Format severity for display
 * @param severity - Severity level
 * @returns Formatted severity object
 */
export function formatSeverity(severity: ChangeSeverity) {
  return SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.info;
}

/**
 * Format source type for display
 * @param source - Source type
 * @returns Formatted source object
 */
export function formatSource(source: ChangeSource) {
  return SOURCE_CONFIG[source] || SOURCE_CONFIG.system;
}

/**
 * Format change type for display
 * @param changeType - Change type string
 * @returns Human-readable label
 */
export function formatChangeType(changeType: string): string {
  // Check for direct match
  if (CHANGE_TYPE_LABELS[changeType]) {
    return CHANGE_TYPE_LABELS[changeType];
  }

  // Handle compound types like "status_change:inactive"
  const basetype = changeType.split(':')[0];
  if (CHANGE_TYPE_LABELS[basetype]) {
    return CHANGE_TYPE_LABELS[basetype];
  }

  // Fallback: convert snake_case to Title Case
  return changeType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Get icon name for entity type
 * @param entityType - Entity type string
 * @returns Icon name (for lucide-react)
 */
export function getEntityIcon(entityType: string): string {
  return ENTITY_ICONS[entityType] || 'FileText';
}

/**
 * Format diff for display
 * @param diff - Diff object with before/after values
 * @returns Array of formatted field changes
 */
export function formatDiff(diff?: Record<string, { from: unknown; to: unknown }>): Array<{
  field: string;
  label: string;
  from: string;
  to: string;
  isSignificant: boolean;
}> {
  if (!diff) return [];

  return Object.entries(diff).map(([field, values]) => {
    const from = formatValue(values.from);
    const to = formatValue(values.to);
    const isSignificant = isSignificantChange(field, values.from, values.to);

    return {
      field,
      label: formatFieldLabel(field),
      from,
      to,
      isSignificant,
    };
  });
}

/**
 * Format a field label for display
 * @param field - Field name (snake_case)
 * @returns Human-readable label
 */
export function formatFieldLabel(field: string): string {
  return field
    .replace(/_id$/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Format a value for display
 * @param value - Any value
 * @returns String representation
 */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    // Format as currency if looks like money
    if (value >= 100 && Number.isInteger(value * 100)) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(value);
    }
    return value.toLocaleString();
  }
  if (value instanceof Date) return value.toLocaleDateString();
  if (typeof value === 'string') {
    // Check if ISO date
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      try {
        return new Date(value).toLocaleDateString();
      } catch {
        // Not a valid date, return as-is
      }
    }
    return value;
  }
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Check if a field change is significant
 * @param field - Field name
 * @param from - Previous value
 * @param to - New value
 * @returns Whether the change is significant
 */
export function isSignificantChange(field: string, from: unknown, to: unknown): boolean {
  // Status/stage changes are always significant
  if (['status', 'stage', 'state'].includes(field)) return true;

  // Amount changes over 10% are significant
  if (['amount', 'price', 'total', 'value'].includes(field)) {
    const fromNum = Number(from) || 0;
    const toNum = Number(to) || 0;
    if (fromNum === 0) return toNum > 0;
    return Math.abs((toNum - fromNum) / fromNum) > 0.1;
  }

  // Owner/assignment changes are significant
  if (field.includes('owner') || field.includes('assigned')) return true;

  return false;
}

/**
 * Generate a title for a change event
 * @param event - Partial change event data
 * @returns Generated title string
 */
export function generateChangeTitle(event: {
  changeType: string;
  entityType: string;
  entityTitle?: string;
  diff?: Record<string, { from: unknown; to: unknown }>;
}): string {
  const action = formatChangeType(event.changeType);
  const entityLabel = formatFieldLabel(event.entityType);
  const title = event.entityTitle || entityLabel;

  // Special cases
  if (event.changeType === 'status_change' && event.diff?.status) {
    return `${title} ${action.toLowerCase()} to ${formatValue(event.diff.status.to)}`;
  }

  if (event.changeType === 'stage_change' && event.diff?.stage) {
    return `${title} moved to ${formatValue(event.diff.stage.to)}`;
  }

  if (event.changeType === 'assignment' && event.diff?.assigned_to) {
    return `${title} assigned`;
  }

  return `${title} ${action.toLowerCase()}`;
}

/**
 * Generate a description for a change event
 * @param event - Partial change event data
 * @returns Generated description string
 */
export function generateChangeDescription(event: {
  changeType: string;
  entityType: string;
  diff?: Record<string, { from: unknown; to: unknown }>;
  sourceType?: ChangeSource;
  sourceName?: string;
}): string {
  const parts: string[] = [];

  // Add field changes summary
  if (event.diff) {
    const changes = formatDiff(event.diff);
    const significant = changes.filter((c) => c.isSignificant);
    if (significant.length > 0) {
      const changeSummary = significant
        .slice(0, 3)
        .map((c) => `${c.label}: ${c.from} → ${c.to}`)
        .join(', ');
      parts.push(changeSummary);
    }
  }

  // Add source info
  if (event.sourceName) {
    parts.push(`via ${event.sourceName}`);
  } else if (event.sourceType && event.sourceType !== 'user') {
    parts.push(`by ${formatSource(event.sourceType).label}`);
  }

  return parts.join(' • ');
}

/**
 * Group events by time period
 * @param events - Array of change events
 * @returns Grouped events by time period
 */
export function groupEventsByPeriod(events: ChangeEventWithActor[]): Map<string, ChangeEventWithActor[]> {
  const groups = new Map<string, ChangeEventWithActor[]>();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  for (const event of events) {
    const eventDate = new Date(event.created_at);
    let period: string;

    if (eventDate >= today) {
      period = 'Today';
    } else if (eventDate >= yesterday) {
      period = 'Yesterday';
    } else if (eventDate >= lastWeek) {
      period = 'This Week';
    } else {
      period = 'Earlier';
    }

    if (!groups.has(period)) {
      groups.set(period, []);
    }
    groups.get(period)!.push(event);
  }

  return groups;
}
