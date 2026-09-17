import type { EnrollmentMatchDecision, RosterMatch, SponsorRelationship, RosterStatus } from './types';

export function normalizeNamePart(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizeDob(value: string | null | undefined): string {
  if (!value) return '';
  const trimmed = value.trim();
  const iso = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  return '';
}

/** first|last|YYYY-MM-DD — same shape as sponsor_roster.match_key */
export function rosterMatchKey(
  firstName: string,
  lastName: string,
  dateOfBirth?: string | null
): string {
  return `${normalizeNamePart(firstName)}|${normalizeNamePart(lastName)}|${normalizeDob(dateOfBirth)}`;
}

export function decideEnrollmentMatch(
  sponsorId: string | null | undefined,
  matches: RosterMatch[]
): EnrollmentMatchDecision {
  if (!sponsorId) {
    return { outcome: 'no_sponsor', reason: 'Landing page is not attached to a sponsor.' };
  }
  if (matches.length === 0) {
    return {
      outcome: 'needs_approval',
      reason: 'No roster match on first name, last name, and date of birth. Held for employer approval.',
    };
  }
  if (matches.length > 1) {
    return {
      outcome: 'needs_approval',
      reason: 'Ambiguous roster match. Held for employer approval.',
    };
  }
  const roster = matches[0];
  if (roster.status === 'terminated') {
    return {
      outcome: 'needs_approval',
      roster,
      reason: 'Matched roster person is terminated. Held for employer approval.',
    };
  }
  return {
    outcome: 'matched',
    roster,
    reason: 'Matched eligible roster person.',
  };
}

export function parseRelationship(value: string | null | undefined): SponsorRelationship {
  const v = (value ?? '').trim().toLowerCase();
  if (v === 'spouse' || v === 'husband' || v === 'wife') return 'spouse';
  if (v === 'child' || v === 'dependent' || v === 'son' || v === 'daughter') return 'child';
  return 'employee';
}

export function parseRosterStatus(value: string | null | undefined): RosterStatus {
  const v = (value ?? '').trim().toLowerCase();
  if (v === 'terminated' || v === 'term' || v === 'ended' || v === 'inactive') return 'terminated';
  if (v === 'enrolled') return 'enrolled';
  if (v === 'pending_approval' || v === 'pending') return 'pending_approval';
  return 'eligible';
}
