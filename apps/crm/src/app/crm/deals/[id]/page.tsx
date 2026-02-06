import { redirect } from 'next/navigation';

interface PageProps {
  params: { id: string };
}

export default async function DealDetailPage({ params }: PageProps) {
  const { id } = params;
  redirect(`/crm/r/${id}`);
}
