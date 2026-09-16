import type { GizmoHowto, GizmoPlace } from '../types';

export const ADVISOR_PORTAL_PLACES: GizmoPlace[] = [
  { id: 'ap-dash', title: 'Dashboard', href: '/dashboard', aliases: ['home'] },
  { id: 'ap-contacts', title: 'Contacts', href: '/contacts', aliases: ['people', 'book'] },
  { id: 'ap-pricing', title: 'Pricing', href: '/pricing', aliases: ['rates', 'quotes'] },
  { id: 'ap-engagement', title: 'Engagement', href: '/engagement', aliases: ['messages'] },
  { id: 'ap-training', title: 'Training', href: '/training', aliases: ['learn', 'courses'] },
  { id: 'ap-team', title: 'Team', href: '/team', aliases: ['downline', 'agency'] },
  { id: 'ap-presentations', title: 'Presentations', href: '/presentations', aliases: ['decks'] },
];

export const ADVISOR_PORTAL_HOWTO: GizmoHowto[] = [
  {
    id: 'ap-howto-team',
    title: 'See your team',
    href: '/team',
    aliases: ['downline', 'agency'],
    steps: ['Open Team.', 'Your downline shows here when your agency record allows it.'],
  },
];
