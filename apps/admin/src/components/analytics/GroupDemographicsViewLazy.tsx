'use client';

import dynamic from 'next/dynamic';

const GroupDemographicsView = dynamic(
  () => import('./GroupDemographicsView').then((m) => m.GroupDemographicsView),
  { ssr: false }
);

export function GroupDemographicsViewLazy({ data }: { data: unknown }) {
  return <GroupDemographicsView data={data} />;
}
