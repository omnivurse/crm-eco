import { CASH_PAY_BRAND } from '@crm-eco/cash-pay';

/**
 * White-label knobs over the shared Cash Pay Advocate brand.
 * A future HCL skin overrides these via Vercel env — not a second codebase.
 */
export const brand = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME || CASH_PAY_BRAND.name,
  product: process.env.NEXT_PUBLIC_BRAND_PRODUCT || CASH_PAY_BRAND.product,
  advocate: process.env.NEXT_PUBLIC_BRAND_ADVOCATE || CASH_PAY_BRAND.advocate,
  tagline: process.env.NEXT_PUBLIC_BRAND_TAGLINE || CASH_PAY_BRAND.tagline,
  signal: process.env.NEXT_PUBLIC_BRAND_SIGNAL || CASH_PAY_BRAND.signal,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://cashpay.doublehelixhub.com',
  logo: CASH_PAY_BRAND.logoPath,
  logoWhite: '/logo-white.png',
  logoIcon: '/logo-icon.png',
  colors: CASH_PAY_BRAND.colors,
};
