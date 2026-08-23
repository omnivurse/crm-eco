/**
 * One promise for every search entry point.
 *
 * The CRM had five search boxes with five different placeholders ("Search
 * people, deals, or start a workflow…", "Search or workflow…", "Search records,
 * run commands…", "Search contacts..."). They all hit the same `/api/crm/search`
 * and the same ⌘K palette, so they should say the same thing — and the thing
 * they should say is what a rep actually types: a name, a phone number or a
 * member # (email works too; the accessible label says so).
 *
 * NV-1 (Road to Ten): the visible string is deliberately compact so the SAME
 * text fits, un-truncated, in the top-bar pill (min-w 160/220 px) and the w-52
 * sidebar trigger as well as the wide palette input — identical text on every
 * surface, never an ellipsis on the promise itself. The walk (e2e/specs/
 * walk-nav.spec.ts NV-search-copy) asserts that parity.
 *
 * Isomorphic (no React, no server imports) so both client shells and server
 * components can import it.
 */

/**
 * Canonical placeholder for every global search box / palette input AND the
 * accessible name of the icon-only search buttons (mobile top bar, collapsed
 * sidebar): one visible promise everywhere.
 */
export const SEARCH_PLACEHOLDER = 'Search name, phone, member #…';

/**
 * Placeholder used when the palette is opened on a record page and can also
 * jump to fields on that record. Keeps the shared promise, adds the extra.
 */
export const SEARCH_PLACEHOLDER_ON_RECORD = 'Jump to field, or search name, phone, member #…';

/**
 * Accessible label for the search INPUT (palette `aria-label`). Spells out
 * the full promise — email included — for assistive tech; the visible
 * placeholder stays compact so it never truncates.
 */
export const SEARCH_ARIA_LABEL = 'Search the CRM by name, email, phone or member number';

/** Sidebar / analytics labels — Members is the CRM module, not the admin roster. */
export { CRM_MEMBERS_LABEL, MEMBER_ROSTER_LABEL, ADVISORS_LABEL } from './nav-lexicon';
