import { HEALTH_SHARING_DATA_KEYS } from '@/lib/crm/lead-contact-sharing-fields';

/** Minimal member row needed to resolve a CRM contact record. */
export interface MemberCrmLookupInput {
  id: string;
  email?: string | null;
  phone?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  member_number?: string | null;
}

/** Candidate CRM record row used for scoring. */
export interface MemberCrmRecordCandidate {
  id: string;
  email?: string | null;
  phone?: string | null;
  source_record_id?: string | null;
  market_type?: string | null;
  updated_at?: string | null;
  data?: Record<string, unknown> | null;
  module_key?: string | null;
}

const LEGACY_SHARING_KEYS = [
  'carrier',
  'product',
  'coverage_option',
  'monthly_premium',
  'monthly_share',
  'start_date',
] as const;

const MODULE_PRIORITY: Record<string, number> = {
  contacts: 0,
  members: 1,
  leads: 2,
};

function normalizeEmail(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

/** Strip non-digits so `940-735-9792` and `9407359792` compare equal. */
export function normalizePhone(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '');
}

function normalizeName(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function isPopulated(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (typeof value === 'number') return !Number.isNaN(value);
  if (typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}

function recordData(candidate: MemberCrmRecordCandidate): Record<string, unknown> {
  const raw = candidate.data;
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
}

/** Count populated health-share / legacy coverage keys on a CRM record. */
export function scoreMemberCrmRecordCoverage(candidate: MemberCrmRecordCandidate): number {
  const data = recordData(candidate);
  let score = 0;

  for (const key of HEALTH_SHARING_DATA_KEYS) {
    if (isPopulated(data[key])) score += 2;
  }
  for (const key of LEGACY_SHARING_KEYS) {
    if (isPopulated(data[key])) score += 1;
  }
  if (candidate.market_type === 'healthshare') score += 3;
  if (candidate.source_record_id) score += 2;
  if (isPopulated(data.linked_member_id)) score += 1;

  return score;
}

function emailsForMember(member: MemberCrmLookupInput): Set<string> {
  const out = new Set<string>();
  const primary = normalizeEmail(member.email);
  if (primary) out.add(primary);
  return out;
}

function emailsForRecord(candidate: MemberCrmRecordCandidate): Set<string> {
  const data = recordData(candidate);
  const out = new Set<string>();
  const primary = normalizeEmail(candidate.email);
  if (primary) out.add(primary);
  const jsonEmail = normalizeEmail(typeof data.email === 'string' ? data.email : null);
  if (jsonEmail) out.add(jsonEmail);
  const secondary = normalizeEmail(
    typeof data.secondary_email === 'string' ? data.secondary_email : null,
  );
  if (secondary) out.add(secondary);
  // Members-module / portal twins often store the Zoho email as email2.
  const email2 = normalizeEmail(typeof data.email2 === 'string' ? data.email2 : null);
  if (email2) out.add(email2);
  return out;
}

function namesMatch(
  member: MemberCrmLookupInput,
  candidate: MemberCrmRecordCandidate,
): boolean {
  const data = recordData(candidate);
  const memberFirst = normalizeName(member.first_name);
  const memberLast = normalizeName(member.last_name);
  if (!memberFirst || !memberLast) return false;
  return (
    normalizeName(typeof data.first_name === 'string' ? data.first_name : null) === memberFirst &&
    normalizeName(typeof data.last_name === 'string' ? data.last_name : null) === memberLast
  );
}

export type MemberCrmMatchReason =
  | 'linked_member_id'
  | 'member_number'
  | 'email'
  | 'secondary_email'
  | 'phone_name'
  | 'email_via_twin';

/** True when the candidate plausibly represents the same person as the member row. */
export function memberMatchesCrmRecord(
  member: MemberCrmLookupInput,
  candidate: MemberCrmRecordCandidate,
): { matched: boolean; reason?: MemberCrmMatchReason } {
  const data = recordData(candidate);

  if (typeof data.linked_member_id === 'string' && data.linked_member_id === member.id) {
    return { matched: true, reason: 'linked_member_id' };
  }

  const memberNumber = (member.member_number ?? '').trim();
  const recordMemberNumber =
    typeof data.member_number === 'string' ? data.member_number.trim() : '';
  if (memberNumber && recordMemberNumber && memberNumber === recordMemberNumber) {
    return { matched: true, reason: 'member_number' };
  }

  const memberEmails = emailsForMember(member);
  const recordEmails = emailsForRecord(candidate);
  for (const email of memberEmails) {
    if (recordEmails.has(email)) {
      return {
        matched: true,
        reason: email === normalizeEmail(member.email) ? 'email' : 'secondary_email',
      };
    }
  }

  const memberPhone = normalizePhone(member.phone);
  if (memberPhone && namesMatch(member, candidate)) {
    const recordPhone = normalizePhone(candidate.phone);
    const jsonPhone = normalizePhone(typeof data.phone === 'string' ? data.phone : null);
    if (memberPhone === recordPhone || memberPhone === jsonPhone) {
      return { matched: true, reason: 'phone_name' };
    }
  }

  return { matched: false };
}

type ScoredMatch = {
  candidate: MemberCrmRecordCandidate;
  matched: boolean;
  reason?: MemberCrmMatchReason;
};

/**
 * After direct matches (linked id / member # / billing email), also accept
 * candidates that share an email with a verified twin — e.g. members-module
 * row has email2=gmail while Zoho contact primary is gmail.
 */
function bridgeMatchesViaTwinEmails(
  member: MemberCrmLookupInput,
  candidates: MemberCrmRecordCandidate[],
  directMatches: ScoredMatch[],
): ScoredMatch[] {
  if (directMatches.length === 0) return [];

  const bridgeEmails = new Set<string>();
  for (const match of directMatches) {
    for (const email of emailsForRecord(match.candidate)) {
      bridgeEmails.add(email);
    }
  }
  if (bridgeEmails.size === 0) return [];

  const directIds = new Set(directMatches.map((m) => m.candidate.id));
  const bridged: ScoredMatch[] = [];
  for (const candidate of candidates) {
    if (directIds.has(candidate.id)) continue;
    const emails = emailsForRecord(candidate);
    let hit = false;
    for (const email of emails) {
      if (bridgeEmails.has(email)) {
        hit = true;
        break;
      }
    }
    // Alternate emails are frequently shared by spouses or households. An
    // email overlap alone must not redirect one member to another person's
    // richer CRM record; require a second same-person signal.
    const data = recordData(candidate);
    const memberNumber = (member.member_number ?? '').trim();
    const candidateMemberNumber =
      typeof data.member_number === 'string' ? data.member_number.trim() : '';
    const identityCorroborated =
      (typeof data.linked_member_id === 'string' && data.linked_member_id === member.id) ||
      (memberNumber !== '' &&
        candidateMemberNumber !== '' &&
        memberNumber === candidateMemberNumber) ||
      namesMatch(member, candidate);

    if (hit && identityCorroborated) {
      bridged.push({ candidate, matched: true, reason: 'email_via_twin' });
    }
  }
  return bridged;
}

/**
 * Pick the best CRM record for an enrollment member. When multiple contacts
 * match (common after Zoho import + enrollment_sync stub), prefer the record
 * with richer health-sharing coverage data.
 */
export function pickBestMemberCrmRecord(
  member: MemberCrmLookupInput,
  candidates: MemberCrmRecordCandidate[],
): MemberCrmRecordCandidate | null {
  const directMatches = candidates
    .map((candidate) => ({
      candidate,
      ...memberMatchesCrmRecord(member, candidate),
    }))
    .filter((entry) => entry.matched);

  const matches: ScoredMatch[] = [
    ...directMatches,
    ...bridgeMatchesViaTwinEmails(member, candidates, directMatches),
  ];

  if (matches.length === 0) return null;

  matches.sort((a, b) => {
    const coverageDiff = scoreMemberCrmRecordCoverage(b.candidate) - scoreMemberCrmRecordCoverage(a.candidate);
    if (coverageDiff !== 0) return coverageDiff;

    const moduleDiff =
      (MODULE_PRIORITY[a.candidate.module_key ?? 'unknown'] ?? 99) -
      (MODULE_PRIORITY[b.candidate.module_key ?? 'unknown'] ?? 99);
    if (moduleDiff !== 0) return moduleDiff;

    const updatedA = Date.parse(a.candidate.updated_at ?? '') || 0;
    const updatedB = Date.parse(b.candidate.updated_at ?? '') || 0;
    return updatedB - updatedA;
  });

  return matches[0]?.candidate ?? null;
}
