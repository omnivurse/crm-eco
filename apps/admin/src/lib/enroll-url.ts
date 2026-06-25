/**
 * Public enrollment URL for agent landing-page / enrollment links.
 *
 * The secure form is served on tenant-facing enrollment domains (e.g.
 * `enroll.payitforwardhealth.com`), NEVER on `admin.*`. Source of truth is
 * `NEXT_PUBLIC_ENROLLMENT_URL` (set per tenant on the admin deploy); the fallback
 * derives an `enroll.` host from the current admin origin so a missing env never
 * leaks an `admin.` link.
 */
export function enrollPublicBaseUrl(): string {
  const env = process.env.NEXT_PUBLIC_ENROLLMENT_URL;
  if (env) return env.replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    return window.location.origin.replace('admin.', 'enroll.');
  }
  return '';
}

/** Full public URL for a landing-page slug, e.g. https://enroll.tenant.com/enroll/<slug>. */
export function enrollPublicUrl(slug: string): string {
  return `${enrollPublicBaseUrl()}/enroll/${slug}`;
}
