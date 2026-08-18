import Link from 'next/link';
import { BrandLogo } from '../brand-logo';
import { authForm } from './auth-form-styles';

export interface AuthFormHeaderProps {
  title: string;
  subtitle: string;
  homeHref?: string;
  /** NEW. Mono eyebrow above the title (e.g. 'CRM Core'). */
  eyebrow?: string;
}

/**
 * Wordmark + title block at the head of an auth form.
 *
 * `tone` was `white` on both marks, which meant the wordmark was white-on-white
 * and effectively invisible on the light theme — the form panel is
 * `--auth-panel`, not a dark card. It is `auto` now, which is what the split
 * layout's panel has always needed.
 */
export function AuthFormHeader({
  title,
  subtitle,
  homeHref = '/',
  eyebrow,
}: AuthFormHeaderProps) {
  return (
    <div className="text-center lg:text-left">
      <Link href={homeHref} className="mb-6 inline-flex items-center lg:hidden">
        <BrandLogo variant="full" size="md" tone="auto" />
      </Link>
      <Link href={homeHref} className="mb-6 hidden items-center lg:inline-flex">
        <BrandLogo variant="full" size="lg" tone="auto" priority />
      </Link>
      {eyebrow ? <p className={authForm.eyebrow}>{eyebrow}</p> : null}
      <h2 className={authForm.title}>{title}</h2>
      <p className={authForm.subtitle}>{subtitle}</p>
    </div>
  );
}
