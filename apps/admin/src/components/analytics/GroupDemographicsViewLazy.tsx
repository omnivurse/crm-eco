'use client';

import dynamic from 'next/dynamic';
import type { DemographicsData } from './GroupDemographicsView';

const GroupDemographicsView = dynamic(
  () => import('./GroupDemographicsView').then((m) => m.GroupDemographicsView),
  { ssr: false }
);

export function GroupDemographicsViewLazy({ data }: { data: DemographicsData }) {
  return <GroupDemographicsView data={data} />;
}
