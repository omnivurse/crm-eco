'use client';

import dynamic from 'next/dynamic';
import type { ActuarialData } from './ActuarialExperienceView';

const ActuarialExperienceView = dynamic(
  () => import('./ActuarialExperienceView').then((m) => m.ActuarialExperienceView),
  { ssr: false }
);

export function ActuarialExperienceViewLazy({ data }: { data: ActuarialData }) {
  return <ActuarialExperienceView data={data} />;
}
