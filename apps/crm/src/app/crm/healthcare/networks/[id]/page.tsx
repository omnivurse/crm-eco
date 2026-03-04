import NetworkDetailClient from './client';

export default async function NetworkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <NetworkDetailClient networkId={id} />;
}
