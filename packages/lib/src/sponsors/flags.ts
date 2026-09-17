export function isKnownRosterEnabled(): boolean {
  return process.env.SPONSOR_KNOWN_ROSTER_ENABLED === 'true';
}

export function isSponsorEmailEnabled(): boolean {
  return process.env.SPONSOR_EMAIL_ENABLED === 'true';
}

export function isSponsorEligibilityJobEnabled(): boolean {
  return process.env.SPONSOR_ELIGIBILITY_JOB_ENABLED !== 'false';
}

/** Sponsor landing: never take the employee's card, even if approval is pending. */
export function shouldSkipMemberChargeForSponsor(outcome: string): boolean {
  return outcome === 'matched' || outcome === 'needs_approval';
}

/** Only a clean roster match may create the membership before employer review. */
export function shouldProvisionSponsorPaidEnrollment(outcome: string): boolean {
  return outcome === 'matched';
}
