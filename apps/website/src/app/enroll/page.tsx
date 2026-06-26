import { redirect } from 'next/navigation';

/**
 * Marketing → enrollment-software redirect.
 *
 * The secure enrollment form is no longer hosted here (payitforwardhealth.com is
 * a marketing site). It lives in the admin enrollment software, served on the
 * tenant enrollment domain (NEXT_PUBLIC_ENROLLMENT_URL, e.g.
 * https://enroll.payitforwardhealth.com). This route preserves any query string
 * (?agent=, ?plan=, …) so attribution survives the hop.
 */
const ENROLLMENT_URL =
  process.env.NEXT_PUBLIC_ENROLLMENT_URL || 'https://enroll.payitforwardhealth.com';

export const dynamic = 'force-dynamic';

export default async function EnrollRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string') qs.set(k, v);
  }
  const query = qs.toString();
  redirect(`${ENROLLMENT_URL}/enroll${query ? `?${query}` : ''}`);
}
