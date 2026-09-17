export type SponsorshipDecision = 'approve' | 'deny';

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
