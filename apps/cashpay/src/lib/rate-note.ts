import { buildCompareRateNoteHtml, openRateNoteWindow, type RateNoteTick } from '@crm-eco/cash-pay';
import { brand } from './brand';

export type { RateNoteTick };
export { escapeHtml } from '@crm-eco/cash-pay';

export type RateNoteInput = {
  ticks: RateNoteTick[];
  metro: string;
  procedureCode: string;
  asOf: string;
  logoUrl: string;
};

export function buildRateNoteHtml(input: RateNoteInput): string {
  return buildCompareRateNoteHtml({ ...input, brand });
}

export function openRateNote(input: Omit<RateNoteInput, 'asOf' | 'logoUrl'> & { logoUrl?: string }): boolean {
  if (input.ticks.length === 0) return false;
  const logoUrl = input.logoUrl || new URL(brand.logo, window.location.origin).href;
  return openRateNoteWindow(
    buildRateNoteHtml({
      ...input,
      logoUrl,
      asOf: new Date().toLocaleDateString(),
    }),
  );
}
