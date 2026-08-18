import Image from 'next/image';
import styles from './crm-landing.module.css';

/**
 * A real screenshot of the real CRM, rendered from the real components with
 * invented demo data (see `__stills/`). Two files ship — one per theme — and
 * CSS paints exactly one, because the theme is a class on <html> rather than
 * an OS preference. The unpainted one is `display: none`, so assistive tech
 * only ever sees a single image.
 *
 * HONESTY: nothing in here is drawn with divs. If a surface has no honest
 * still, the tile goes typographic instead.
 */
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
      priority={priority}
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
