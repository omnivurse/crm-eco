export interface EligibleMembership {
  membership_id: string;
  roster_id: string | null;
  sponsorship_id: string | null;
  member_id: string;
  status: string;
  end_date: string | null;
  eligible_end: string | null;
}

export interface EligibilityEndAction {
  membership_id: string;
  sponsorship_id: string | null;
  roster_id: string | null;
  member_id: string;
  end_date: string;
  event_type: 'ended' | 'skipped';
  message: string;
}

/** End memberships whose roster eligibility has ended and coverage is still open. */
export function planEligibilityEndings(
  rows: EligibleMembership[],
  asOfIso: string
): EligibilityEndAction[] {
  const asOf = asOfIso.slice(0, 10);
  return rows.map((row) => {
    const eligibleEnd = row.eligible_end?.slice(0, 10) ?? null;
    if (!eligibleEnd || eligibleEnd > asOf) {
      return {
        membership_id: row.membership_id,
        sponsorship_id: row.sponsorship_id,
        roster_id: row.roster_id,
        member_id: row.member_id,
        end_date: eligibleEnd ?? asOf,
        event_type: 'skipped' as const,
        message: 'Eligibility still open',
      };
    }
    if (row.status === 'terminated' || row.status === 'ended' || row.status === 'cancelled') {
      return {
        membership_id: row.membership_id,
        sponsorship_id: row.sponsorship_id,
        roster_id: row.roster_id,
        member_id: row.member_id,
        end_date: eligibleEnd,
        event_type: 'skipped' as const,
        message: 'Membership already ended',
      };
    }
    if (row.end_date && row.end_date <= eligibleEnd) {
      return {
        membership_id: row.membership_id,
        sponsorship_id: row.sponsorship_id,
        roster_id: row.roster_id,
        member_id: row.member_id,
        end_date: row.end_date,
        event_type: 'skipped' as const,
        message: 'End date already set',
      };
    }
    return {
      membership_id: row.membership_id,
      sponsorship_id: row.sponsorship_id,
      roster_id: row.roster_id,
      member_id: row.member_id,
      end_date: eligibleEnd,
      event_type: 'ended' as const,
      message: `Eligibility ended ${eligibleEnd}`,
    };
  });
}
