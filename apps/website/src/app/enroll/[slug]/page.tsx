import { redirect } from 'next/navigation';

/**
 * Marketing → enrollment-software redirect for agent landing-page slugs.
 *
 * The branded secure form now lives in the admin enrollment software on the
 * tenant enrollment domain (NEXT_PUBLIC_ENROLLMENT_URL). This route forwards the
 * slug so an existing payitforwardhealth.com/enroll/<slug> link keeps working.
 */
const ENROLLMENT_URL =
  process.env.NEXT_PUBLIC_ENROLLMENT_URL || 'https://enroll.payitforwardhealth.com';

export const dynamic = 'force-dynamic';

export default async function SlugEnrollRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`${ENROLLMENT_URL}/enroll/${slug}`);
}
