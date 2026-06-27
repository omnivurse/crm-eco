import { redirect } from 'next/navigation';

export default async function EditMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/members/${id}?tab=profile`);
}
