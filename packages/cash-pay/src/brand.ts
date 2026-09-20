/**
 * Cash Pay Advocate brand. Colors are sampled from the Double Helix Hub mark
 * (helix teal, wordmark violet, node bronze).
 */
export const CASH_PAY_BRAND = {
  name: 'Double Helix Hub',
  product: 'Cash Pay',
  advocate: 'Cash Pay Advocate',
  tagline: 'Fair for All.',
  signal: '#8A4E12',
  logoPath: '/logo.png',
  colors: {
    violet: '#3B145B',
    teal: '#1088A2',
    tealInk: '#0C6F85',
    bronze: '#AC641F',
    bronzeInk: '#8A4E12',
    mist: '#F3FAFB',
    night: '#0A1216',
  },
} as const;

export type CashPayBrand = {
  name: string;
  product: string;
  advocate: string;
  tagline: string;
  signal: string;
  colors: typeof CASH_PAY_BRAND.colors;
};
