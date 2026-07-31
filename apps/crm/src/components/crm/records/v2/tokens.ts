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
/*
 * Palettes deepened for legibility: text moved to the 800 step (light) / 200
 * step (dark) and rings to a full 300 step / 40% alpha, so the tile, tags and
 * module chips read with clear contrast instead of the old washed-out pastels.
 */
export const MODULE_PALETTES: Record<string, ModulePalette> = {
  leads: {
    bg: 'bg-violet-100 dark:bg-violet-500/20',
    text: 'text-violet-800 dark:text-violet-200',
    ring: 'ring-violet-300 dark:ring-violet-500/40',
    accent: 'text-violet-700 dark:text-violet-300',
  },
  contacts: {
    bg: 'bg-teal-100 dark:bg-teal-500/20',
    text: 'text-teal-800 dark:text-teal-200',
    ring: 'ring-teal-300 dark:ring-teal-500/40',
    accent: 'text-teal-700 dark:text-teal-300',
  },
  deals: {
    bg: 'bg-emerald-100 dark:bg-emerald-500/20',
    text: 'text-emerald-800 dark:text-emerald-200',
    ring: 'ring-emerald-300 dark:ring-emerald-500/40',
    accent: 'text-emerald-700 dark:text-emerald-300',
  },
  accounts: {
    bg: 'bg-amber-100 dark:bg-amber-500/20',
    text: 'text-amber-800 dark:text-amber-200',
    ring: 'ring-amber-300 dark:ring-amber-500/40',
    accent: 'text-amber-700 dark:text-amber-300',
  },
  providers: {
    bg: 'bg-sky-100 dark:bg-sky-500/20',
    text: 'text-sky-800 dark:text-sky-200',
    ring: 'ring-sky-300 dark:ring-sky-500/40',
    accent: 'text-sky-700 dark:text-sky-300',
  },
  producers: {
    bg: 'bg-rose-100 dark:bg-rose-500/20',
    text: 'text-rose-800 dark:text-rose-200',
    ring: 'ring-rose-300 dark:ring-rose-500/40',
    accent: 'text-rose-700 dark:text-rose-300',
  },
  tickets: {
    bg: 'bg-orange-100 dark:bg-orange-500/20',
    text: 'text-orange-800 dark:text-orange-200',
    ring: 'ring-orange-300 dark:ring-orange-500/40',
    accent: 'text-orange-700 dark:text-orange-300',
  },
};

/**
 * Fallback palettes for modules without a canonical color. Selected via a
 * deterministic hash so the same record name always gets the same color.
 */
export const FALLBACK_PALETTES: ModulePalette[] = [
  {
    bg: 'bg-slate-100 dark:bg-slate-500/20',
    text: 'text-slate-800 dark:text-slate-200',
    ring: 'ring-slate-300 dark:ring-slate-500/40',
  },
  {
    bg: 'bg-fuchsia-100 dark:bg-fuchsia-500/20',
    text: 'text-fuchsia-800 dark:text-fuchsia-200',
    ring: 'ring-fuchsia-300 dark:ring-fuchsia-500/40',
  },
  {
    bg: 'bg-indigo-100 dark:bg-indigo-500/20',
    text: 'text-indigo-800 dark:text-indigo-200',
    ring: 'ring-indigo-300 dark:ring-indigo-500/40',
  },
  {
    bg: 'bg-cyan-100 dark:bg-cyan-500/20',
    text: 'text-cyan-800 dark:text-cyan-200',
    ring: 'ring-cyan-300 dark:ring-cyan-500/40',
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
