import { describe, expect, it } from 'vitest';
import {
  APPROVED_NEED_STATUSES,
  HIGH_URGENCY_LIGHTS,
  PENDING_NEED_STATUSES,
  isPortalShareRequest,
} from './display';

describe('needs display', () => {
  it('counts portal drafts (open) as pending review', () => {
    expect(PENDING_NEED_STATUSES).toContain('open');
    expect(PENDING_NEED_STATUSES).toContain('in_review');
  });

  it('treats SLA urgency as green/orange/red, not urgent/high', () => {
    expect([...HIGH_URGENCY_LIGHTS]).toEqual(['orange', 'red']);
  });

  it('labels a member-portal share request from custom_fields', () => {
    expect(isPortalShareRequest({ share_request: { request_type: 'surgery' } })).toBe(true);
    expect(isPortalShareRequest({ notes: 'staff' })).toBe(false);
    expect(isPortalShareRequest(null)).toBe(false);
  });

  it('sums approved + paid for the approved-amount stat', () => {
    expect([...APPROVED_NEED_STATUSES]).toEqual(['approved', 'paid']);
  });
});
