/**
 * One promise for every search entry point.
 *
 * The CRM had five search boxes with five different placeholders ("Search
 * people, deals, or start a workflow…", "Search or workflow…", "Search records,
 * run commands…", "Search contacts..."). They all hit the same `/api/crm/search`
 * and the same ⌘K palette, so they should say the same thing — and the thing
 * they should say is what a rep actually types: a name, an email, a phone
 * number or a member #.
 *
 * Isomorphic (no React, no server imports) so both client shells and server
 * components can import it.
 */

/** Canonical placeholder for every global search box / palette input. */
export const SEARCH_PLACEHOLDER = 'Search name, email, phone or member #…';

/**
 * Placeholder used when the palette is opened on a record page and can also
 * jump to fields on that record. Keeps the shared promise, adds the extra.
 */
export const SEARCH_PLACEHOLDER_ON_RECORD = 'Jump to field, or search name, email, phone or member #…';

/** Accessible label for the search input (aria-label / sr-only text). */
export const SEARCH_ARIA_LABEL = 'Search the CRM by name, email, phone or member number';
