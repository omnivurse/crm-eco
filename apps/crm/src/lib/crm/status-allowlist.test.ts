import { describe, expect, it } from 'vitest';
import {
  CRM_ALLOWED_STATUSES,
  CRM_LIFECYCLE_STATUSES,
  CRM_PIPELINE_STATUSES,
  allowedStatusesForModule,
  isAllowedCrmStatus,
  statusPickerGroupsForModule,
} from './status-allowlist';

describe('status vocabulary', () => {
  it('is exactly the agreed words — no legacy variant survives', () => {
    expect([...CRM_LIFECYCLE_STATUSES]).toEqual([
      'Active', 'Inactive', 'Pending', 'In Process', 'Cancelled', 'Terminated', 'Deceased',
      'Prospect', 'Lost', 'Declined', 'Abandoned',
    ]);
    expect([...CRM_PIPELINE_STATUSES]).toEqual([
      'New', 'Attempted', 'Contacted', 'Qualified', 'Future Prospect', 'In Process', 'Pending',
      'Converted', 'Unqualified', 'Lost',
    ]);
    for (const legacy of ['Active HS Member', 'Active Insurance Client', 'In-Active', 'Enrolled - 2026', 'Hot Prospect - ready to move', 'Cancellation Pending', 'Hold', 'Archived', 'Working']) {
      expect(CRM_ALLOWED_STATUSES).not.toContain(legacy);
    }
  });

  it('is module-aware: leads take the pipeline, contacts/members the lifecycle', () => {
    expect(isAllowedCrmStatus('Converted', 'leads')).toBe(true);
    expect(isAllowedCrmStatus('Converted', 'contacts')).toBe(false);
    expect(isAllowedCrmStatus('Declined', 'contacts')).toBe(true);
    expect(isAllowedCrmStatus('Declined', 'leads')).toBe(false);
    expect(isAllowedCrmStatus('Abandoned', 'members')).toBe(true);
    // unknown module → union, so nothing legitimate is blocked app-side;
    // the database guard is the precise one
    expect(isAllowedCrmStatus('Converted')).toBe(true);
    expect(isAllowedCrmStatus('Converted', 'advisors')).toBe(true);
    expect(allowedStatusesForModule('leads')).toEqual(CRM_PIPELINE_STATUSES);
    expect(allowedStatusesForModule('history')).toEqual(CRM_LIFECYCLE_STATUSES);
    expect(isAllowedCrmStatus('Cancelled', 'history')).toBe(true);
  });

  it('groups the header picker per module with every word accounted for', () => {
    const flat = (m: string) => statusPickerGroupsForModule(m).flatMap((g) => [...g.items]).sort();
    expect(flat('contacts')).toEqual([...CRM_LIFECYCLE_STATUSES].sort());
    expect(flat('leads')).toEqual([...CRM_PIPELINE_STATUSES].sort());
    expect(statusPickerGroupsForModule('leads')[0].label).toBe('Stage');
  });
});
