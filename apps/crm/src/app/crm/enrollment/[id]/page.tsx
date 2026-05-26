import { redirect } from 'next/navigation';

/** Legacy path support: /crm/enrollment/[id] → /crm/enrollment?id=[id] */
export default async function EnrollmentLegacyRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/crm/enrollment?id=${encodeURIComponent(id)}`);
}
