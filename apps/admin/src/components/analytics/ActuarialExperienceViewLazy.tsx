'use client';

import dynamic from 'next/dynamic';

const ActuarialExperienceView = dynamic(
  () => import('./ActuarialExperienceView').then((m) => m.ActuarialExperienceView),
  { ssr: false }
);

export function ActuarialExperienceViewLazy({ data }: { data: unknown }) {
  return <ActuarialExperienceView data={data} />;
}
