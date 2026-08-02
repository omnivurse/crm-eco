import type { AgeBand } from './types';

/** Canonical MSA age bands from the provisional rate sheet */
export const MSA_AGE_BANDS: AgeBand[] = [
  { id: '18-34', min: 18, max: 34, label: '18–34' },
  { id: '35-49', min: 35, max: 49, label: '35–49' },
  { id: '50-59', min: 50, max: 59, label: '50–59' },
  { id: '60-64', min: 60, max: 64, label: '60–64' },
];

export const MSA_COVERAGE_TIERS = [
  'member',
  'member_spouse',
  'member_children',
  'family',
] as const;
