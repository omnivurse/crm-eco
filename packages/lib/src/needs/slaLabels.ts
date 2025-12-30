/**
 * Shared SLA label helpers for Needs
 * Used by both CRM and Member Portal for consistent SLA display
 */

import type { UrgencyLight } from '../types';

/**
 * Get a short, member-friendly label for urgency level
 */
export function getUrgencyLabel(urgency: UrgencyLight): string {
  switch (urgency) {
    case 'green':
      return 'On track';
    case 'orange':
      return 'Approaching target date';
    case 'red':
      return 'Needs attention';
    default:
      return 'Not set';
  }
}

/**
 * Get a longer description explaining the urgency level
 */
export function getUrgencyDescription(urgency: UrgencyLight): string {
  switch (urgency) {
    case 'green':
      return 'This Need is within the expected processing timeline.';
    case 'orange':
      return 'This Need is approaching its target completion date.';
    case 'red':
      return 'This Need is past its target completion date and should be prioritized.';
    default:
      return 'No SLA target has been set yet.';
  }
}

/**
 * Get a semantic variant for badge styling
 * Maps to common UI library badge variants
 */
export function getUrgencyBadgeVariant(
  urgency: UrgencyLight
): 'success' | 'warning' | 'destructive' | 'secondary' {
  switch (urgency) {
    case 'green':
      return 'success';
    case 'orange':
      return 'warning';
    case 'red':
      return 'destructive';
    default:
      return 'secondary';
  }
}

/**
 * Get CSS classes for urgency dot/indicator
 */
export function getUrgencyDotClass(urgency: UrgencyLight): string {
  switch (urgency) {
    case 'green':
      return 'bg-emerald-500';
    case 'orange':
      return 'bg-amber-500';
    case 'red':
      return 'bg-red-500';
    default:
      return 'bg-slate-400';
  }
}

/**
 * Get CSS classes for urgency text color
 */
export function getUrgencyTextClass(urgency: UrgencyLight): string {
  switch (urgency) {
    case 'green':
      return 'text-emerald-700';
    case 'orange':
      return 'text-amber-700';
    case 'red':
      return 'text-red-700';
    default:
      return 'text-slate-500';
  }
}

/**
 * Get CSS classes for urgency badge background
 */
export function getUrgencyBadgeClass(urgency: UrgencyLight): string {
  switch (urgency) {
    case 'green':
      return 'bg-emerald-500 text-white';
    case 'orange':
      return 'bg-amber-500 text-white';
    case 'red':
      return 'bg-red-500 text-white';
    default:
      return 'bg-slate-200 text-slate-600';
  }
}

/**
 * Get a short CRM-focused label (slightly different tone)
 */
export function getUrgencyLabelCRM(urgency: UrgencyLight): string {
  switch (urgency) {
    case 'green':
      return 'On Track';
    case 'orange':
      return 'At-Risk';
    case 'red':
      return 'Overdue';
    default:
      return 'No SLA';
  }
}

