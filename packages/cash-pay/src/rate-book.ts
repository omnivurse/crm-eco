import type { CashRateRow } from './types';

export const MAX_CLIPS_PER_BOOK = 50;
export const MAX_BOOKS_PER_MEMBER = 10;
export const DEFAULT_BOOK_NAME = 'Saved rates';

/** Dated snapshot of one published tick. HCL ids can move; this row is the truth. */
export interface RateClipSnapshot extends CashRateRow {
  queryStateName: string;
  queryMsaName: string;
  querySpecialty: string;
  clippedAt: string;
  sliceHigh: number | null;
  sliceMedian: number | null;
  fileSize: number | null;
}

export interface RateBookCompile {
  clipCount: number;
  cashTotal: number;
  low: number | null;
  median: number | null;
  high: number | null;
  cmsMin: number | null;
  cmsMax: number | null;
  /** Sum of (page high − cash) at clip time. Null when no clip stored a page high. */
  vsSliceHigh: number | null;
  /** Sum of (page median − cash) at clip time. Null when no clip stored a page median. */
  vsSliceMedian: number | null;
  /** Callers must surface this; do not relabel as a metro or insurance savings. */
  scope: 'book';
}

export function clipIdentity(row: {
  id: number | string;
  facilityName: string;
  procedureCode: string;
}): string {
  return `${row.id}-${row.facilityName}-${row.procedureCode}`;
}

function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function vsStored(
  clips: RateClipSnapshot[],
  pick: (clip: RateClipSnapshot) => number | null,
): number | null {
  const used = clips.filter((clip) => {
    const value = pick(clip);
    return value != null && Number.isFinite(value) && Number.isFinite(clip.rate);
  });
  if (used.length === 0) return null;
  return used.reduce((sum, clip) => {
    const value = pick(clip) as number;
    return sum + Math.max(0, value - clip.rate);
  }, 0);
}

/**
 * Compile one book. Extrema come from clipped cash, never from a live HCL file.
 * vsSlice* only exist when the member clipped from a page that stored those stats.
 */
export function compileRateBook(clips: RateClipSnapshot[]): RateBookCompile {
  const rates = clips
    .map((clip) => clip.rate)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  const cms = clips
    .map((clip) => clip.cmsRelativity)
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
    .sort((a, b) => a - b);

  return {
    clipCount: clips.length,
    cashTotal: rates.reduce((sum, n) => sum + n, 0),
    low: rates[0] ?? null,
    median: median(rates),
    high: rates.length ? rates[rates.length - 1] : null,
    cmsMin: cms[0] ?? null,
    cmsMax: cms.length ? cms[cms.length - 1] : null,
    vsSliceHigh: vsStored(clips, (clip) => clip.sliceHigh),
    vsSliceMedian: vsStored(clips, (clip) => clip.sliceMedian),
    scope: 'book',
  };
}

export function sanitizeBookName(raw: string | null | undefined): string | null {
  const name = (raw ?? '').trim().replace(/\s+/g, ' ');
  if (name.length < 1 || name.length > 60) return null;
  return name;
}
