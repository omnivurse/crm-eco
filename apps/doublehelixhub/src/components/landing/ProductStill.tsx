import Image from 'next/image';
import styles from './dhh-landing.module.css';

/**
 * A real screenshot of a real Double Helix product, rendered from the real
 * components with invented demo data. The corporate site does not own a
 * product surface of its own, so every still here is the SAME file the
 * product landing ships — copied from apps/crm/public/landing and
 * apps/admin/public/landing into this app's public/landing.
 *
 * Two files ship per still — one per theme — and CSS paints exactly one,
 * because the theme is a class on <html> rather than an OS preference, so
 * <picture> + prefers-color-scheme cannot follow the header toggle. The
 * unpainted one is `display: none`, so assistive tech only ever announces a
 * single image.
 *
 * HONESTY: nothing in here is drawn with divs. If a surface has no honest
 * still, the tile goes typographic (+ a strand ornament) instead. Do not
 * invent a screenshot, and do not describe a still as showing something it
 * does not show.
 */

/** Every still that exists in this app's public/landing, with its intrinsic size. */
export const PRODUCT_STILLS = {
  'crm-desk': { name: 'crm-desk', width: 2896, height: 1516 },
  'crm-record': { name: 'crm-record', width: 996, height: 1293 },
  'crm-coverage': { name: 'crm-coverage', width: 2096, height: 382 },
  'mms-console': { name: 'mms-console', width: 2592, height: 1002 },
  'mms-queue': { name: 'mms-queue', width: 1792, height: 1056 },
  'mms-registry': { name: 'mms-registry', width: 3032, height: 1284 },
} as const satisfies Record<string, { name: string; width: number; height: number }>;

export type ProductStillName = keyof typeof PRODUCT_STILLS;

export interface ProductStillProps {
  /** Base name under /public/landing, e.g. 'crm-desk' -> crm-desk-{theme}.png */
  name: string;
  /** Describe what is on screen, and say that the data is fictional. */
  alt: string;
  /** Intrinsic pixel size of the PNG (both themes render identically). */
  width: number;
  height: number;
  /** Layout hint for the srcset. */
  sizes: string;
  /** Extra class on the <img> — cropping/fit, from the page's CSS module. */
  imgClassName?: string;
  priority?: boolean;
}

export function ProductStill({
  name,
  alt,
  width,
  height,
  sizes,
  imgClassName,
  priority = false,
}: ProductStillProps) {
  const themed = (theme: 'light' | 'dark') => (
    <Image
      src={`/landing/${name}-${theme}.png`}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      /* `priority` on both twins preloads an image that can never be painted:
         exactly one is display:block. Light is the server default (see
         theme-provider's getServerSnapshot), so it is the only twin that can
         be the LCP element; the dark twin is lazy and fetches when the toggle
         reveals it. */
      priority={priority && theme === 'light'}
      loading={priority && theme === 'dark' ? 'lazy' : undefined}
      className={[theme === 'light' ? styles.lightShot : styles.darkShot, imgClassName]
        .filter(Boolean)
        .join(' ')}
    />
  );

  return (
    <>
      {themed('light')}
      {themed('dark')}
    </>
  );
}
