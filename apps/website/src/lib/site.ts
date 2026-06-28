/**
 * Pay It Forward Health — central site configuration.
 * One place for brand identity, contact details, navigation and the portal URL,
 * so every page/section stays consistent.
 *
 * NOTE: phone uses the reserved fictional 555-01xx range as a PLACEHOLDER —
 * replace `PHONE` with the real member line before launch.
 */

export const BRAND = {
  name: 'Pay It Forward Health',
  shortName: 'Pay It Forward',
  tagline: 'The caring alternative to health insurance',
  // Platform note: PIFH is a tenant brand on the DoubleHelixHub platform.
  platform: 'DoubleHelixHub',
} as const;

export const PHONE = {
  display: '(800) 555-0100', // PLACEHOLDER — replace with real member line
  tel: '18005550100',
} as const;

export const EMAIL = {
  general: 'hello@payitforwardhealth.com',
  support: 'support@payitforwardhealth.com',
  sales: 'membership@payitforwardhealth.com',
} as const;

export const PORTAL_URL =
  process.env.NEXT_PUBLIC_PORTAL_URL || 'https://members.payitforwardhealth.com';

export const SOCIAL = {
  facebook: 'https://facebook.com',
  instagram: 'https://instagram.com',
  twitter: 'https://twitter.com',
  linkedin: 'https://linkedin.com',
} as const;

/** Primary navigation — mirrors a healthshare IA (Zion-style groupings). */
export type NavChild = { name: string; href: string; description?: string };
export type NavItem = { name: string; href: string; children?: NavChild[] };

export const NAV: NavItem[] = [
  {
    name: 'How It Works',
    href: '/how-it-works',
    children: [
      { name: 'How Sharing Works', href: '/how-it-works', description: 'The simple, transparent way members share costs' },
      { name: 'Member Guidelines', href: '/legal/sharing-guidelines', description: 'What is eligible for sharing' },
      { name: 'FAQs', href: '/faq', description: 'Answers to common questions' },
      { name: 'About Us', href: '/about', description: 'Our mission and community' },
    ],
  },
  {
    name: 'Memberships',
    href: '/plans',
    children: [
      { name: 'Individuals & Families', href: '/memberships/individuals', description: 'Flexible sharing for your household' },
      { name: 'Companies & Teams', href: '/memberships/employers', description: 'A benefit your team can afford' },
      { name: 'Direct Primary Care', href: '/direct-primary-care', description: 'Unlimited access to your own doctor' },
      { name: 'Plans & Pricing', href: '/plans', description: 'Compare programs and monthly shares' },
      { name: 'Member Services', href: '/services', description: 'Telehealth, Rx savings, advocacy & more' },
    ],
  },
  {
    name: 'Resources',
    href: '/blog',
    children: [
      { name: 'Blog & Stories', href: '/blog', description: 'Learn, explore, and read member stories' },
      { name: 'Member Reviews', href: '/reviews', description: 'What our community is saying' },
      { name: 'Medical Advocacy', href: '/medical-advocacy', description: 'We negotiate bills on your behalf' },
      { name: 'Giving Fund', href: '/giving-fund', description: 'Sharing beyond the guidelines' },
    ],
  },
  { name: 'Contact', href: '/contact' },
];

/** Smaller audience links shown in the utility bar. */
export const UTILITY_LINKS: NavChild[] = [
  { name: 'For Members', href: PORTAL_URL },
  { name: 'For Advisors', href: '/for-advisors' },
  { name: 'For Employers', href: '/memberships/employers' },
];

/** Trust stats shown across the site. Adjust to real figures when available. */
export const STATS = {
  members: '12,000+',
  shared: '$48M+',
  satisfaction: '4.9/5',
  savings: 'up to 50%',
} as const;
