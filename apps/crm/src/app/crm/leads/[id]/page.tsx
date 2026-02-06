import { redirect } from 'next/navigation';

interface PageProps {
  params: { id: string };
}

export default async function LeadDetailPage({ params }: PageProps) {
  const { id } = params;
  redirect(`/crm/r/${id}`);
}
