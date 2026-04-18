/**
 * Design tokens for the V2 record detail layout.
 *
 * Centralizes palette definitions that would otherwise drift across
 * components (avatar tile, module badges, tag chips, insight pills).
 * Keeping these in one file makes it trivial to retheme the V2 layout
 * without touching every component.
 *
 * Each palette is a quartet of Tailwind class fragments so callers can
 * apply them composably with `cn()`.
 */

export interface ModulePalette {
  /** Background fill (light + dark). */
  bg: string;
  /** Foreground / text colour. */
  text: string;
  /** Inset ring colour for the subtle border. */
  ring: string;
  /** Optional stronger accent (e.g. badge text on solid bg). */
  accent?: string;
}

/**
 * Per-module palettes. Module keys that aren't in this map fall back to
 * `FALLBACK_PALETTES` via `resolveModulePalette()`.
 */
export const MODULE_PALETTES: Record<string, ModulePalette> = {
  leads: {
    bg: 'bg-violet-100 dark:bg-violet-500/15',
    text: 'text-violet-700 dark:text-violet-300',
    ring: 'ring-violet-200 dark:ring-violet-500/20',
    accent: 'text-violet-600 dark:text-violet-400',
  },
  contacts: {
    bg: 'bg-teal-100 dark:bg-teal-500/15',
    text: 'text-teal-700 dark:text-teal-300',
    ring: 'ring-teal-200 dark:ring-teal-500/20',
    accent: 'text-teal-600 dark:text-teal-400',
  },
  deals: {
    bg: 'bg-emerald-100 dark:bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-300',
    ring: 'ring-emerald-200 dark:ring-emerald-500/20',
    accent: 'text-emerald-600 dark:text-emerald-400',
  },
  accounts: {
    bg: 'bg-amber-100 dark:bg-amber-500/15',
    text: 'text-amber-700 dark:text-amber-300',
    ring: 'ring-amber-200 dark:ring-amber-500/20',
    accent: 'text-amber-600 dark:text-amber-400',
  },
  providers: {
    bg: 'bg-sky-100 dark:bg-sky-500/15',
    text: 'text-sky-700 dark:text-sky-300',
    ring: 'ring-sky-200 dark:ring-sky-500/20',
    accent: 'text-sky-600 dark:text-sky-400',
  },
  producers: {
    bg: 'bg-rose-100 dark:bg-rose-500/15',
    text: 'text-rose-700 dark:text-rose-300',
    ring: 'ring-rose-200 dark:ring-rose-500/20',
    accent: 'text-rose-600 dark:text-rose-400',
  },
  tickets: {
    bg: 'bg-orange-100 dark:bg-orange-500/15',
    text: 'text-orange-700 dark:text-orange-300',
    ring: 'ring-orange-200 dark:ring-orange-500/20',
    accent: 'text-orange-600 dark:text-orange-400',
  },
};

/**
 * Fallback palettes for modules without a canonical color. Selected via a
 * deterministic hash so the same record name always gets the same color.
 */
export const FALLBACK_PALETTES: ModulePalette[] = [
  {
    bg: 'bg-slate-100 dark:bg-slate-500/15',
    text: 'text-slate-700 dark:text-slate-300',
    ring: 'ring-slate-200 dark:ring-slate-500/20',
  },
  {
    bg: 'bg-fuchsia-100 dark:bg-fuchsia-500/15',
    text: 'text-fuchsia-700 dark:text-fuchsia-300',
    ring: 'ring-fuchsia-200 dark:ring-fuchsia-500/20',
  },
  {
    bg: 'bg-indigo-100 dark:bg-indigo-500/15',
    text: 'text-indigo-700 dark:text-indigo-300',
    ring: 'ring-indigo-200 dark:ring-indigo-500/20',
  },
  {
    bg: 'bg-cyan-100 dark:bg-cyan-500/15',
    text: 'text-cyan-700 dark:text-cyan-300',
    ring: 'ring-cyan-200 dark:ring-cyan-500/20',
  },
];

/**
 * Resolve a palette by module key, falling back to a deterministic hash on
 * `seed` (typically the record name).
 */
export function resolveModulePalette(
  moduleKey: string | undefined | null,
  seed: string = '',
): ModulePalette {
  if (moduleKey && MODULE_PALETTES[moduleKey]) return MODULE_PALETTES[moduleKey];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_PALETTES[hash % FALLBACK_PALETTES.length];
}

/**
 * Avatar tile size scale. Exposed so other record-scoped components (e.g. a
 * list-row avatar) can stay in sync with the header tile.
 */
export const AVATAR_SIZES = {
  sm: 'w-9 h-9 text-sm',
  md: 'w-12 h-12 text-base',
  lg: 'w-16 h-16 text-xl',
} as const;

export type AvatarSize = keyof typeof AVATAR_SIZES;
