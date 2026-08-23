/**
 * One lexicon for people lists and the people navigation.
 *
 * Members       = CRM module `/crm/modules/members`
 * Member Roster = admin portal `/crm/members`
 * Advisors      = CRM module `/crm/modules/advisors` (there is no
 *                 `/crm/advisors` route — see nav-profile.ts moduleHref)
 * People        = the CRM sidebar section that holds the people modules
 *                 (D10: was "Sales Pipeline"; the section KEY stays
 *                 `sec-pipeline` so nav-profile.ts can inject into it)
 */

export const CRM_MEMBERS_HREF = '/crm/modules/members';
export const MEMBER_ROSTER_HREF = '/crm/members';
export const ADVISORS_HREF = '/crm/modules/advisors';

export const CRM_MEMBERS_LABEL = 'Members';
export const MEMBER_ROSTER_LABEL = 'Member Roster';
export const ADVISORS_LABEL = 'Advisors';
/** Singular, for "Assign Advisor" / "Choose an Advisor" copy (never "Advisor / Agent"). */
export const ADVISOR_LABEL = 'Advisor';

/** CRM sidebar section heading for the people modules (D10). */
export const PEOPLE_SECTION_LABEL = 'People';
