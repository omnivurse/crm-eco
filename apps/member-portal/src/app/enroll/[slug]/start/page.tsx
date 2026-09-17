import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ slug: string }>;
}

/** The full wizard now lives on /enroll/[slug]. Keep this URL working. */
export default async function EnrollStartRedirect({ params }: PageProps) {
  const { slug } = await params;
  redirect(`/enroll/${slug}`);
}
