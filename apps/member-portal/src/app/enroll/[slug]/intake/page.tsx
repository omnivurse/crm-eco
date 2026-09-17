import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ slug: string }>;
}

/** Legacy /start used to send people here; the wizard is on /enroll/[slug]. */
export default async function EnrollIntakeRedirect({ params }: PageProps) {
  const { slug } = await params;
  redirect(`/enroll/${slug}`);
}
