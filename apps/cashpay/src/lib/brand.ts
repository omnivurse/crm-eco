/**
 * Cash Pay Advocate brand. Colors are sampled from public/logo.png
 * (helix teal, wordmark violet, node bronze) — not a second palette.
 * A future HCL skin may override name/product/signal via Vercel env.
 */
export const brand = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME || 'Double Helix Hub',
  product: process.env.NEXT_PUBLIC_BRAND_PRODUCT || 'Cash Pay',
  advocate: process.env.NEXT_PUBLIC_BRAND_ADVOCATE || 'Cash Pay Advocate',
  tagline: process.env.NEXT_PUBLIC_BRAND_TAGLINE || 'Fair for All.',
  signal: process.env.NEXT_PUBLIC_BRAND_SIGNAL || '#8A4E12',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://cashpay.doublehelixhub.com',
  logo: '/logo.png',
  logoWhite: '/logo-white.png',
  logoIcon: '/logo-icon.png',
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
