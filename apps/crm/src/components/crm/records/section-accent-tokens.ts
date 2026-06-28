/**
 * Shared section accent tokens — single source for nav pills and section cards.
 */

import type { LayoutSectionAccent } from '@/lib/crm/types';

export interface NavAccentClassSet {
  inactive: string;
  inactiveBadge: string;
  active: string;
  activeBadge: string;
}

export interface CardAccentClassSet {
  border: string;
  header: string;
  title: string;
  ring: string;
}

export const SECTION_NAV_ACCENT_CLASSES: Record<LayoutSectionAccent, NavAccentClassSet> = {
  slate: {
    inactive:
      'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/60 hover:text-slate-900 dark:hover:text-white',
    inactiveBadge: 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400',
    active: 'bg-slate-500/10 text-slate-700 dark:text-slate-200 ring-1 ring-slate-500/30',
    activeBadge: 'bg-slate-500/20 text-slate-700 dark:text-slate-200',
  },
  emerald: {
    inactive:
      'bg-emerald-50 dark:bg-emerald-500/5 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/10',
    inactiveBadge: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    active: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/40',
    activeBadge: 'bg-emerald-500/25 text-emerald-700 dark:text-emerald-200',
  },
  blue: {
    inactive:
      'bg-blue-50 dark:bg-blue-500/5 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-500/10',
    inactiveBadge: 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300',
    active: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/40',
    activeBadge: 'bg-blue-500/25 text-blue-700 dark:text-blue-200',
  },
  cyan: {
    inactive:
      'bg-cyan-50 dark:bg-cyan-500/5 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-500/10',
    inactiveBadge: 'bg-cyan-100 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
    active: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 ring-1 ring-cyan-500/40',
    activeBadge: 'bg-cyan-500/25 text-cyan-700 dark:text-cyan-200',
  },
  purple: {
    inactive:
      'bg-purple-50 dark:bg-purple-500/5 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-500/10',
    inactiveBadge: 'bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300',
    active: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 ring-1 ring-purple-500/40',
    activeBadge: 'bg-purple-500/25 text-purple-700 dark:text-purple-200',
  },
  amber: {
    inactive:
      'bg-amber-50 dark:bg-amber-500/5 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/10',
    inactiveBadge: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300',
    active: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/40',
    activeBadge: 'bg-amber-500/25 text-amber-700 dark:text-amber-200',
  },
  rose: {
    inactive:
      'bg-rose-50 dark:bg-rose-500/5 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-500/10',
    inactiveBadge: 'bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300',
    active: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/40',
    activeBadge: 'bg-rose-500/25 text-rose-700 dark:text-rose-200',
  },
  pink: {
    inactive:
      'bg-pink-50 dark:bg-pink-500/5 text-pink-700 dark:text-pink-300 hover:bg-pink-100 dark:hover:bg-pink-500/10',
    inactiveBadge: 'bg-pink-100 dark:bg-pink-500/15 text-pink-700 dark:text-pink-300',
    active: 'bg-pink-500/15 text-pink-700 dark:text-pink-300 ring-1 ring-pink-500/40',
    activeBadge: 'bg-pink-500/25 text-pink-700 dark:text-pink-200',
  },
  indigo: {
    inactive:
      'bg-indigo-50 dark:bg-indigo-500/5 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-500/10',
    inactiveBadge: 'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
    active: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500/40',
    activeBadge: 'bg-indigo-500/25 text-indigo-700 dark:text-indigo-200',
  },
  teal: {
    inactive:
      'bg-teal-50 dark:bg-teal-500/5 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-500/10',
    inactiveBadge: 'bg-teal-100 dark:bg-teal-500/15 text-teal-700 dark:text-teal-300',
    active: 'bg-teal-500/15 text-teal-700 dark:text-teal-300 ring-1 ring-teal-500/40',
    activeBadge: 'bg-teal-500/25 text-teal-700 dark:text-teal-200',
  },
  sky: {
    inactive:
      'bg-sky-50 dark:bg-sky-500/5 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-500/10',
    inactiveBadge: 'bg-sky-100 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300',
    active: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 ring-1 ring-sky-500/40',
    activeBadge: 'bg-sky-500/25 text-sky-700 dark:text-sky-200',
  },
  violet: {
    inactive:
      'bg-violet-50 dark:bg-violet-500/5 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-500/10',
    inactiveBadge: 'bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300',
    active: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 ring-1 ring-violet-500/40',
    activeBadge: 'bg-violet-500/25 text-violet-700 dark:text-violet-200',
  },
  orange: {
    inactive:
      'bg-orange-50 dark:bg-orange-500/5 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-500/10',
    inactiveBadge: 'bg-orange-100 dark:bg-orange-500/15 text-orange-700 dark:text-orange-300',
    active: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 ring-1 ring-orange-500/40',
    activeBadge: 'bg-orange-500/25 text-orange-700 dark:text-orange-200',
  },
  fuchsia: {
    inactive:
      'bg-fuchsia-50 dark:bg-fuchsia-500/5 text-fuchsia-700 dark:text-fuchsia-300 hover:bg-fuchsia-100 dark:hover:bg-fuchsia-500/10',
    inactiveBadge: 'bg-fuchsia-100 dark:bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300',
    active: 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 ring-1 ring-fuchsia-500/40',
    activeBadge: 'bg-fuchsia-500/25 text-fuchsia-700 dark:text-fuchsia-200',
  },
  lime: {
    inactive:
      'bg-lime-50 dark:bg-lime-500/5 text-lime-700 dark:text-lime-300 hover:bg-lime-100 dark:hover:bg-lime-500/10',
    inactiveBadge: 'bg-lime-100 dark:bg-lime-500/15 text-lime-700 dark:text-lime-300',
    active: 'bg-lime-500/15 text-lime-700 dark:text-lime-300 ring-1 ring-lime-500/40',
    activeBadge: 'bg-lime-500/25 text-lime-700 dark:text-lime-200',
  },
};

export const SECTION_CARD_ACCENT_CLASSES: Record<LayoutSectionAccent, CardAccentClassSet> = {
  slate: {
    border: 'border-slate-200 dark:border-slate-700',
    header: 'bg-slate-50/70 dark:bg-slate-800/40',
    title: 'text-slate-700 dark:text-slate-200',
    ring: 'ring-slate-200/60 dark:ring-slate-700/60',
  },
  emerald: {
    border: 'border-emerald-200 dark:border-emerald-700/40',
    header: 'bg-emerald-50/70 dark:bg-emerald-500/10',
    title: 'text-emerald-700 dark:text-emerald-300',
    ring: 'ring-emerald-200/60 dark:ring-emerald-700/40',
  },
  blue: {
    border: 'border-blue-200 dark:border-blue-700/40',
    header: 'bg-blue-50/70 dark:bg-blue-500/10',
    title: 'text-blue-700 dark:text-blue-300',
    ring: 'ring-blue-200/60 dark:ring-blue-700/40',
  },
  cyan: {
    border: 'border-cyan-200 dark:border-cyan-700/40',
    header: 'bg-cyan-50/70 dark:bg-cyan-500/10',
    title: 'text-cyan-700 dark:text-cyan-300',
    ring: 'ring-cyan-200/60 dark:ring-cyan-700/40',
  },
  purple: {
    border: 'border-purple-200 dark:border-purple-700/40',
    header: 'bg-purple-50/70 dark:bg-purple-500/10',
    title: 'text-purple-700 dark:text-purple-300',
    ring: 'ring-purple-200/60 dark:ring-purple-700/40',
  },
  amber: {
    border: 'border-amber-200 dark:border-amber-700/40',
    header: 'bg-amber-50/70 dark:bg-amber-500/10',
    title: 'text-amber-700 dark:text-amber-300',
    ring: 'ring-amber-200/60 dark:ring-amber-700/40',
  },
  rose: {
    border: 'border-rose-200 dark:border-rose-700/40',
    header: 'bg-rose-50/70 dark:bg-rose-500/10',
    title: 'text-rose-700 dark:text-rose-300',
    ring: 'ring-rose-200/60 dark:ring-rose-700/40',
  },
  pink: {
    border: 'border-pink-200 dark:border-pink-700/40',
    header: 'bg-pink-50/70 dark:bg-pink-500/10',
    title: 'text-pink-700 dark:text-pink-300',
    ring: 'ring-pink-200/60 dark:ring-pink-700/40',
  },
  indigo: {
    border: 'border-indigo-200 dark:border-indigo-700/40',
    header: 'bg-indigo-50/70 dark:bg-indigo-500/10',
    title: 'text-indigo-700 dark:text-indigo-300',
    ring: 'ring-indigo-200/60 dark:ring-indigo-700/40',
  },
  teal: {
    border: 'border-teal-200 dark:border-teal-700/40',
    header: 'bg-teal-50/70 dark:bg-teal-500/10',
    title: 'text-teal-700 dark:text-teal-300',
    ring: 'ring-teal-200/60 dark:ring-teal-700/40',
  },
  sky: {
    border: 'border-sky-200 dark:border-sky-700/40',
    header: 'bg-sky-50/70 dark:bg-sky-500/10',
    title: 'text-sky-700 dark:text-sky-300',
    ring: 'ring-sky-200/60 dark:ring-sky-700/40',
  },
  violet: {
    border: 'border-violet-200 dark:border-violet-700/40',
    header: 'bg-violet-50/70 dark:bg-violet-500/10',
    title: 'text-violet-700 dark:text-violet-300',
    ring: 'ring-violet-200/60 dark:ring-violet-700/40',
  },
  orange: {
    border: 'border-orange-200 dark:border-orange-700/40',
    header: 'bg-orange-50/70 dark:bg-orange-500/10',
    title: 'text-orange-700 dark:text-orange-300',
    ring: 'ring-orange-200/60 dark:ring-orange-700/40',
  },
  fuchsia: {
    border: 'border-fuchsia-200 dark:border-fuchsia-700/40',
    header: 'bg-fuchsia-50/70 dark:bg-fuchsia-500/10',
    title: 'text-fuchsia-700 dark:text-fuchsia-300',
    ring: 'ring-fuchsia-200/60 dark:ring-fuchsia-700/40',
  },
  lime: {
    border: 'border-lime-200 dark:border-lime-700/40',
    header: 'bg-lime-50/70 dark:bg-lime-500/10',
    title: 'text-lime-700 dark:text-lime-300',
    ring: 'ring-lime-200/60 dark:ring-lime-700/40',
  },
};

export function getSectionNavAccent(accent?: LayoutSectionAccent): NavAccentClassSet {
  return SECTION_NAV_ACCENT_CLASSES[accent ?? 'slate'];
}

export function getSectionCardAccent(accent?: LayoutSectionAccent): CardAccentClassSet {
  return SECTION_CARD_ACCENT_CLASSES[accent ?? 'slate'];
}
