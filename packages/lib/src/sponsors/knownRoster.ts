import { rosterMatchKey } from './match';
import type { RosterPersonInput, SponsorRelationship } from './types';

export type KnownRosterAction = 'attach' | 'create' | 'skip' | 'error';

export interface KnownRosterPersonPlan {
  row_number: number;
  action: KnownRosterAction;
  match_key: string;
  member_id?: string | null;
  message: string;
  payload: RosterPersonInput;
}

export interface KnownRosterPlan {
  attach_count: number;
  create_count: number;
  skip_count: number;
  error_count: number;
  rows: KnownRosterPersonPlan[];
}

export interface KnownRosterMemberHit {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string | null;
  email?: string | null;
}

export function planKnownRosterEnroll(
  incoming: RosterPersonInput[],
  existingMembers: KnownRosterMemberHit[],
): KnownRosterPlan {
  const byKey = new Map(
    existingMembers.map((m) => [
      rosterMatchKey(m.first_name, m.last_name, m.date_of_birth),
      m,
    ]),
  );
  const byEmail = new Map(
    existingMembers
      .filter((m) => m.email)
      .map((m) => [m.email!.trim().toLowerCase(), m]),
  );

  const rows: KnownRosterPersonPlan[] = incoming.map((person, index) => {
    const row_number = index + 1;
    const match_key = rosterMatchKey(person.first_name, person.last_name, person.date_of_birth);
    if (person.eligible_end) {
      return {
        row_number,
        action: 'skip',
        match_key,
        message: 'Terminated or ended — not enrolled',
        payload: person,
      };
    }
    const hit =
      byKey.get(match_key) ??
      (person.email ? byEmail.get(person.email.trim().toLowerCase()) : undefined);
    if (hit) {
      return {
        row_number,
        action: 'attach',
        match_key,
        member_id: hit.id,
        message: `Attach existing member ${hit.id}`,
        payload: person,
      };
    }
    if (!person.email?.trim()) {
      return {
        row_number,
        action: 'error',
        match_key,
        message: 'No member match and no email to create one',
        payload: person,
      };
    }
    return {
      row_number,
      action: 'create',
      match_key,
      message: 'Create member + sponsored core membership',
      payload: person,
    };
  });

  return {
    attach_count: rows.filter((r) => r.action === 'attach').length,
    create_count: rows.filter((r) => r.action === 'create').length,
    skip_count: rows.filter((r) => r.action === 'skip').length,
    error_count: rows.filter((r) => r.action === 'error').length,
    rows,
  };
}

export function knownRosterRelationship(value?: string | null): SponsorRelationship {
  if (value === 'spouse' || value === 'child') return value;
  return 'employee';
}
