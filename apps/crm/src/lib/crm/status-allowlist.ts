/**
 * The CRM status vocabulary — the ONLY words a status may hold.
 *
 * Agreed with the owner and client 21–22 Aug 2026 and enforced by the
 * database (crm_status_vocabulary + crm_status_guard trigger). Two lists,
 * because the two module families use the status column differently:
 *
 *   lifecycle — contacts, members, and any other person module: what state
 *               the record is in.
 *   pipeline  — leads: where the prospect sits in the sales pipeline (the
 *               leads module's status IS the stage; lead conversion writes
 *               "Converted" there).
 *
 * The same lists are mirrored in supabase/migrations/20260822150000 (picker
 * options) and 20260822170000 (the guard). Change all three together.
 */
export const CRM_LIFECYCLE_STATUSES = [
  'Active',
  'Inactive',
  'Pending',
  'In Process',
  'Cancelled',
  'Terminated',
  'Deceased',
  'Prospect',
  'Lost',
  'Declined',
  'Abandoned',
] as const;

export const CRM_PIPELINE_STATUSES = [
  'New',
  'Attempted',
  'Contacted',
  'Qualified',
  'Future Prospect',
  'In Process',
  'Pending',
  'Converted',
  'Unqualified',
  'Lost',
] as const;

/** Union of both lists — for callers that do not know the module. */
export const CRM_ALLOWED_STATUSES = [
  ...CRM_LIFECYCLE_STATUSES,
  ...CRM_PIPELINE_STATUSES.filter(
    (s) => !(CRM_LIFECYCLE_STATUSES as readonly string[]).includes(s),
  ),
] as readonly string[];

export type CrmAllowedStatus = (typeof CRM_LIFECYCLE_STATUSES)[number] | (typeof CRM_PIPELINE_STATUSES)[number];

/** The open (still-live) half of each list, for compact pickers. */
export const CRM_LIFECYCLE_OPEN = ['Active', 'Inactive', 'Pending', 'In Process', 'Prospect'] as const;
export const CRM_LIFECYCLE_CLOSED = ['Cancelled', 'Terminated', 'Deceased', 'Lost', 'Declined', 'Abandoned'] as const;
export const CRM_PIPELINE_OPEN = ['New', 'Attempted', 'Contacted', 'Qualified', 'Future Prospect', 'In Process', 'Pending'] as const;
export const CRM_PIPELINE_CLOSED = ['Converted', 'Unqualified', 'Lost'] as const;

/** Compact picker options for inline table editors (lifecycle, open first). */
export const CRM_STATUS_PICKER_CORE = [...CRM_LIFECYCLE_OPEN, ...CRM_LIFECYCLE_CLOSED] as const;

export function isPipelineStatusModule(moduleKey?: string | null): boolean {
  return moduleKey === 'leads';
}

/** Every status a record in this module may hold. Unknown module → the union. */
export function allowedStatusesForModule(moduleKey?: string | null): readonly string[] {
  if (isPipelineStatusModule(moduleKey)) return CRM_PIPELINE_STATUSES;
  if (moduleKey === 'contacts' || moduleKey === 'members' || moduleKey === 'history') {
    return CRM_LIFECYCLE_STATUSES;
  }
  return CRM_ALLOWED_STATUSES;
}

export function isAllowedCrmStatus(status: string, moduleKey?: string | null): boolean {
  return allowedStatusesForModule(moduleKey).includes(status);
}

/** Grouped items for the record-header picker. */
export function statusPickerGroupsForModule(
  moduleKey?: string | null,
): Array<{ label: string; items: readonly string[] }> {
  if (isPipelineStatusModule(moduleKey)) {
    return [
      { label: 'Stage', items: CRM_PIPELINE_OPEN },
      { label: 'Close', items: CRM_PIPELINE_CLOSED },
    ];
  }
  return [
    { label: 'Status', items: CRM_LIFECYCLE_OPEN },
    { label: 'Close', items: CRM_LIFECYCLE_CLOSED },
  ];
}
