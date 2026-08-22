export interface SliceTick {
  rate: number;
  cmsRelativity?: number | null;
}

export interface ResultSliceSummary {
  /** Rows in this page. Never treat as the metro. */
  sliceCount: number;
  low: number | null;
  median: number | null;
  high: number | null;
  cmsMin: number | null;
  cmsMax: number | null;
  /** HCL totalCount for the query. Often millions. */
  fileSize: number;
  /** Callers must surface this; do not relabel as market. */
  scope: 'slice';
}

function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Stats for the current page only.
 * Invariant: extrema come from `ticks`, file size is a separate field.
 */
export function summarizeResultSlice(
  ticks: SliceTick[],
  fileSize: number,
): ResultSliceSummary {
  const rates = ticks
    .map((t) => t.rate)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  const cms = ticks
    .map((t) => t.cmsRelativity)
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
    .sort((a, b) => a - b);

  return {
    sliceCount: ticks.length,
    low: rates[0] ?? null,
    median: median(rates),
    high: rates.length ? rates[rates.length - 1] : null,
    cmsMin: cms[0] ?? null,
    cmsMax: cms.length ? cms[cms.length - 1] : null,
    fileSize: Number.isFinite(fileSize) ? Math.max(0, Math.floor(fileSize)) : 0,
    scope: 'slice',
  };
}
