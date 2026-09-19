export type SponsorshipDecision = 'approve' | 'deny';
export type SponsorAdminRole = 'admin' | 'billing' | 'roster';

export function canManageSponsorApprovals(role: string | null | undefined): boolean {
  return role === 'admin';
}

export function canManageSponsorRoster(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'roster';
}

export function planSponsorshipDecision(input: {
  currentStatus: string;
  decision: SponsorshipDecision;
}): { ok: true; nextStatus: 'pending' | 'ended' } | { ok: false; error: string } {
  if (input.currentStatus !== 'needs_approval') {
    return { ok: false, error: 'Only pending employer approvals can be decided.' };
  }
  if (input.decision === 'approve') {
    return { ok: true, nextStatus: 'pending' };
  }
  return { ok: true, nextStatus: 'ended' };
}
