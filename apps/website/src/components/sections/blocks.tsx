import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@crm-eco/ui/lib/utils';
import type { Icon } from '@phosphor-icons/react';
import { ArrowUpRight } from '@phosphor-icons/react/dist/ssr';
import { imageUrl, type SiteImage } from '@/lib/site-images';

/* ----------------------------------------------------------------- Container */

export function Container({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12', className)}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------- Eyebrow */

export function Eyebrow({
  children,
  className,
  tone = 'teal',
}: {
  children: React.ReactNode;
  className?: string;
  tone?: 'teal' | 'gold' | 'light';
}) {
  return (
    <p
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]',
        tone === 'teal' && 'bg-pif-teal-50/90 text-pif-teal-700 ring-1 ring-pif-teal-100',
        tone === 'gold' && 'bg-pif-gold-50 text-pif-gold-700 ring-1 ring-pif-gold-100',
        tone === 'light' && 'bg-white/10 text-pif-teal-200 ring-1 ring-white/15',
        className,
      )}
    >
      {children}
    </p>
  );
}

/* ------------------------------------------------------------ SectionHeading */

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = 'center',
  tone = 'dark',
  eyebrowTone,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  align?: 'center' | 'left';
  tone?: 'dark' | 'light';
  eyebrowTone?: 'teal' | 'gold' | 'light';
  className?: string;
}) {
  return (
    <div
      className={cn(
        align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-2xl text-left',
        className,
      )}
    >
      {eyebrow && (
        <Eyebrow tone={eyebrowTone ?? (tone === 'light' ? 'light' : 'teal')} className="mb-5">
          {eyebrow}
        </Eyebrow>
      )}
      <h2
        className={cn(
          'font-heading font-medium leading-[1.1] text-balance tracking-[-0.02em]',
          'text-[clamp(1.875rem,3.5vw,2.875rem)]',
          tone === 'light' ? 'text-white' : 'text-pif-navy-800',
        )}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className={cn(
            'mt-5 text-lg leading-relaxed',
            tone === 'light' ? 'text-white/80' : 'text-slate-600',
          )}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ IconChip */

export function IconChip({
  icon: IconComp,
  variant = 'soft',
  className,
}: {
  icon: Icon;
  variant?: 'soft' | 'brand' | 'gold';
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-12 w-12 items-center justify-center rounded-2xl',
        variant === 'soft' && 'bg-pif-teal-50 text-pif-teal-700 ring-1 ring-pif-teal-100',
        variant === 'brand' && 'pif-grad-care text-white shadow-[0_8px_20px_rgba(14,140,154,0.22)]',
        variant === 'gold' && 'pif-grad-gold text-pif-navy-900',
        className,
      )}
    >
      <IconComp className="h-6 w-6" weight="light" />
    </span>
  );
}

/* --------------------------------------------------------------- FeatureCard */

export function FeatureCard({
  icon,
  title,
  children,
  href,
  linkLabel = 'Learn more',
  iconVariant = 'soft',
  className,
}: {
  icon: Icon;
  title: string;
  children: React.ReactNode;
  href?: string;
  linkLabel?: string;
  iconVariant?: 'soft' | 'brand' | 'gold';
  className?: string;
}) {
  return (
    <div className={cn('pif-bezel h-full', className)}>
      <div className="pif-bezel-inner group flex h-full flex-col p-7 transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]">
        <IconChip icon={icon} variant={iconVariant} className="mb-5" />
        <h3 className="font-heading text-xl font-medium text-pif-navy-800">{title}</h3>
        <p className="mt-3 flex-1 leading-relaxed text-slate-600">{children}</p>
        {href && (
          <Link
            href={href}
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-pif-teal-700 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:gap-2.5 hover:text-pif-green-600"
          >
            {linkLabel}
            <ArrowUpRight weight="light" className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- StatStrip */

export type Stat = { value: string; label: string };

export function StatStrip({
  stats,
  tone = 'light',
  className,
}: {
  stats: Stat[];
  tone?: 'light' | 'dark';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'pif-bezel',
        className,
      )}
    >
      <div
        className={cn(
          'pif-bezel-inner grid gap-px overflow-hidden',
          tone === 'dark' ? 'bg-white/10' : 'bg-pif-navy-50',
          stats.length === 4 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3',
        )}
      >
        {stats.map((s) => (
          <div
            key={s.label}
            className={cn('px-6 py-9 text-center', tone === 'dark' ? 'bg-pif-navy-800' : 'bg-white')}
          >
            <div
              className={cn(
                'font-heading text-4xl font-medium tracking-[-0.02em]',
                tone === 'dark' ? 'text-white' : 'gradient-text',
              )}
            >
              {s.value}
            </div>
            <div
              className={cn(
                'mt-2 text-sm font-medium',
                tone === 'dark' ? 'text-white/70' : 'text-slate-500',
              )}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- BrandImage */

export function BrandImage({
  image,
  width = 1100,
  priority = false,
  aspect = 'aspect-[4/3]',
  scrim = true,
  className,
  tilt,
}: {
  image: SiteImage;
  width?: number;
  priority?: boolean;
  aspect?: string;
  scrim?: boolean;
  className?: string;
  tilt?: 'left' | 'right' | 'none';
}) {
  return (
    <div
      className={cn(
        'pif-bezel',
        tilt === 'left' && 'md:-rotate-1',
        tilt === 'right' && 'md:rotate-1',
        className,
      )}
    >
      <div className={cn('pif-bezel-inner relative overflow-hidden', aspect)}>
        <Image
          src={imageUrl(image, width)}
          alt={image.alt}
          fill
          priority={priority}
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover"
        />
        {scrim && (
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-pif-navy-900/30 via-transparent to-transparent" />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ CTABand */

export function CTABand({
  title,
  subtitle,
  primary = { label: 'Become a Member', href: '/enroll' },
  secondary = { label: 'Compare Plans', href: '/plans' },
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  primary?: { label: string; href: string };
  secondary?: { label: string; href: string } | null;
}) {
  return (
    <section className="relative overflow-hidden py-24 md:py-32">
      <div className="absolute inset-4 rounded-[2rem] pif-grad-brand sm:inset-6 md:inset-8" />
      <div className="absolute inset-4 rounded-[2rem] bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.12),transparent_70%)] sm:inset-6 md:inset-8" />
      <Container className="relative text-center py-8">
        <h2 className="mx-auto max-w-3xl font-heading text-[clamp(1.875rem,3.5vw,2.875rem)] font-medium leading-tight tracking-[-0.02em] text-white text-balance">
          {title}
        </h2>
        {subtitle && (
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-white/85">{subtitle}</p>
        )}
        <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row sm:items-center">
          <Link
            href={primary.href}
            className="group inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 font-semibold text-pif-navy-800 shadow-[0_8px_28px_rgba(0,0,0,0.15)] transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]"
          >
            {primary.label}
            <span className="grid h-8 w-8 place-items-center rounded-full bg-pif-navy-800/5 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-px">
              <ArrowUpRight weight="light" className="h-4 w-4" />
            </span>
          </Link>
          {secondary && (
            <Link
              href={secondary.href}
              className="inline-flex items-center justify-center rounded-full border border-white/40 px-6 py-3.5 font-semibold text-white transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-white/10"
            >
              {secondary.label}
            </Link>
          )}
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------- CheckList */

export function CheckList({
  items,
  tone = 'dark',
  className,
}: {
  items: string[];
  tone?: 'dark' | 'light';
  className?: string;
}) {
  return (
    <ul className={cn('space-y-4', className)}>
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3">
          <span
            className={cn(
              'mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full',
              tone === 'light' ? 'bg-white/15 text-pif-gold-300' : 'bg-pif-green-50 text-pif-green-600',
            )}
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M5 10.5 8.5 14 15 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className={cn('leading-relaxed', tone === 'light' ? 'text-white/90' : 'text-slate-700')}>
            {item}
          </span>
        </li>
      ))}
    </ul>
  );
}
