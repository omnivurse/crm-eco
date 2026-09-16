import type { GizmoHowto, GizmoPlace } from '../types';

export const MEMBER_PORTAL_PLACES: GizmoPlace[] = [
  { id: 'mp-home', title: 'Home', href: '/', aliases: ['dashboard', 'start'] },
  { id: 'mp-coverage', title: 'Coverage', href: '/coverage', aliases: ['benefits', 'id card'] },
  { id: 'mp-services', title: 'Services', href: '/services', aliases: ['telehealth', 'rx', 'labs'] },
  { id: 'mp-needs', title: 'Needs', href: '/needs', aliases: ['claims', 'need request', 'sharing request'] },
  { id: 'mp-dependents', title: 'Dependents', href: '/dependents', aliases: ['family', 'spouse', 'kids'] },
  { id: 'mp-billing', title: 'Billing', href: '/billing', aliases: ['pay bill', 'invoice', 'share amount'] },
  { id: 'mp-docs', title: 'Documents', href: '/documents', aliases: ['files', 'paperwork'] },
  { id: 'mp-notifications', title: 'Notifications', href: '/notifications', aliases: ['alerts'] },
  { id: 'mp-settings', title: 'Settings', href: '/settings', aliases: ['password', 'mfa'] },
  { id: 'mp-profile', title: 'Profile', href: '/profile', aliases: ['my account', 'my profile'] },
  { id: 'mp-help', title: 'Support', href: '/support', aliases: ['help', 'contact'] },
  { id: 'mp-plan', title: 'Plan', href: '/plan', aliases: ['my plan', 'change plan'] },
];

export const MEMBER_PORTAL_HOWTO: GizmoHowto[] = [
  {
    id: 'mp-howto-bill',
    title: 'Pay your sharing bill',
    href: '/billing',
    aliases: ['pay bill', 'make a payment', 'invoice'],
    steps: ['Open Billing.', 'Review the amount due.', 'Pay with the card on file or update payment.']
  },
  {
    id: 'mp-howto-needs',
    title: 'Submit a needs request',
    href: '/needs',
    aliases: ['file a need', 'claim', 'medical bill'],
    steps: ['Open Needs.', 'Start a request and attach bills.', 'Track status from the same page.'],
  },
  {
    id: 'mp-howto-coverage',
    title: 'See your coverage',
    href: '/coverage',
    aliases: ['id card', 'benefits', 'what is covered'],
    steps: ['Open Coverage.', 'Your plan and sharing details are on that page.'],
  },
];
