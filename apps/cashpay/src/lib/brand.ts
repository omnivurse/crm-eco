/**
 * White-label knobs. A future HCL skin overrides these via Vercel env —
 * not a second codebase.
 */
export const brand = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME || 'Double Helix Hub',
  product: process.env.NEXT_PUBLIC_BRAND_PRODUCT || 'Cash Pay',
  signal: process.env.NEXT_PUBLIC_BRAND_SIGNAL || '#d97706',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://cashpay.doublehelixhub.com',
};
