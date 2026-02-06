import { redirect } from 'next/navigation';

interface PageProps {
  params: { id: string };
}

export default async function AccountDetailPage({ params }: PageProps) {
  const { id } = params;
  redirect(`/crm/r/${id}`);
}
