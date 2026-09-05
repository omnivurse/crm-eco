/**
 * Sender of last resort for edge functions.
 *
 * Reached only when neither the org's `email_from_address` setting nor the
 * FROM_EMAIL secret is set — a new org before anyone configures email, for
 * instance. It must therefore be a domain that is *verified in Resend*.
 *
 * The previous fallback, mail.doublehelixhub.com, has never been verified and
 * has no DNS records at all, so every send that reached it failed outright
 * with "The mail.doublehelixhub.com domain is not verified". That is a silent
 * trap on password resets, invites and ticket mail for any unconfigured org.
 */
export const FALLBACK_FROM_EMAIL = 'noreply@payitforwardhealth.com';
