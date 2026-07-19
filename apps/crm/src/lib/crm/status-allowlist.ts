/**
 * Single allowlist for CRM operational status values.
 * Used by the status API and UI pickers (header / table / create-lead).
 */
export const CRM_ALLOWED_STATUSES = [
  // Core operational
  'Active',
  'Active HS Member',
  'Active Member',
  'Active Insurance Client',
  'Active DPC',
  'Active ADVISOR',
  'Inactive',
  'In-Active',
  'Pending',
  'Cancelled',
  'Cancellation Pending',
  'Terminated',
  'Converted',
  'Deceased',
  'Hold',
  'Archived',
  'Suspended',
  // Enrollment
  'Enrolled - 2016',
  'Enrolled - 2017',
  'Enrolled - 2018',
  'Enrolled - 2019',
  'Enrolled - 2020',
  'Enrolled 2020',
  'Enrolled - 2021',
  'Enrolled - 2022',
  'Enrolled - 2023',
  'Enrolled - 2024',
  'Enrolled - 2025',
  'Enrolled - 2026',
  'Enrolled Member',
  'Enrolled-2016',
  // Pipeline
  'Approved Pending',
  'Application in Process',
  'Application In Process',
  'In process',
  'In Process',
  'Contacted',
  'Not Contacted',
  'Attempted Contact One',
  'Attempted Contact Two',
  'Attempted Contact Three',
  'Attempted Contact Four',
  'Attempted to Contact',
  // Prospects
  'Hot Prospect - ready to move',
  'Warm Prospect - Maybe',
  'Warm - Future Prospect',
  'Cold Prospect - Released',
  'Future Prospect',
  'DPC Prospect',
  'Agent - Prospect',
  'Agent- PROSPECT',
  'Employee Prospect',
  // Outcomes
  'Lost Opportunity',
  'Dropout',
  'Released',
  'Not Qualified',
  'Junk Lead',
  'Ready to Convert',
  'Closed - New Member',
  'Decision Making Stage',
  'Full Presentation Given - Decision Mode',
  'Full Presentation Completed',
  'Product Selection',
  'Qualification',
  // Special
  'Group Policy',
  'Non Client',
  'PERSONAL',
  'Complimentary',
  'LIVE',
  'Agency- SUPPORT',
  'Agent- SPONSOR',
  'Agent- SPONSOR- InActive',
  'Cancelled - In New CRM',
  'Cancelled Application',
  // Common UI shortcuts also used in list editors
  'New',
  'Qualified',
  'Working',
  'Lost',
  'Prospect',
] as const;

export type CrmAllowedStatus = (typeof CRM_ALLOWED_STATUSES)[number];

/** Compact picker options for inline table / create-lead (subset of allowlist). */
export const CRM_STATUS_PICKER_CORE = [
  'Active',
  'Inactive',
  'Pending',
  'New',
  'Contacted',
  'Not Contacted',
  'Qualified',
  'Working',
  'Converted',
  'Lost',
  'Hot Prospect - ready to move',
  'Prospect',
  'Cancelled',
  'Cancellation Pending',
] as const;

export function isAllowedCrmStatus(status: string): boolean {
  return (CRM_ALLOWED_STATUSES as readonly string[]).includes(status);
}
