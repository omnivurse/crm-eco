import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@crm-eco/ui';
import { cn } from '@crm-eco/ui/lib/utils';
import { ArrowRight, type LucideIcon } from 'lucide-react';
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
        'text-[0.8125rem] font-bold uppercase tracking-[0.2em]',
        tone === 'teal' && 'text-pif-teal-700',
        tone === 'gold' && 'text-pif-gold-600',
        tone === 'light' && 'text-pif-teal-200',
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
  tone?: 'dark' | 'light'; // text color: dark text (on light bg) | light text (on dark bg)
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
        <Eyebrow tone={eyebrowTone ?? (tone === 'light' ? 'light' : 'teal')} className="mb-4">
          {eyebrow}
        </Eyebrow>
      )}
      <h2
        className={cn(
          'font-heading font-semibold leading-[1.12] text-balance',
          'text-[clamp(1.75rem,3.5vw,2.75rem)]',
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
  icon: Icon,
  variant = 'soft',
  className,
}: {
  icon: LucideIcon;
  variant?: 'soft' | 'brand' | 'gold';
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-12 w-12 items-center justify-center rounded-xl',
        variant === 'soft' && 'bg-pif-teal-50 text-pif-teal-700 ring-1 ring-pif-teal-100',
        variant === 'brand' && 'pif-grad-care text-white shadow-md shadow-pif-teal/25',
        variant === 'gold' && 'pif-grad-gold text-pif-navy-900',
        className,
      )}
    >
      <Icon className="h-6 w-6" strokeWidth={2} />
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
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  href?: string;
  linkLabel?: string;
  iconVariant?: 'soft' | 'brand' | 'gold';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'group flex h-full flex-col rounded-2xl border border-pif-navy-100 bg-white p-7 shadow-sm ring-1 ring-pif-navy/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-pif-navy/10',
        className,
      )}
    >
      <IconChip icon={icon} variant={iconVariant} className="mb-5" />
      <h3 className="font-heading text-xl font-semibold text-pif-navy-800">{title}</h3>
      <p className="mt-3 flex-1 leading-relaxed text-slate-600">{children}</p>
      {href && (
        <Link
          href={href}
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-pif-teal-700 transition-colors hover:text-pif-green-600"
        >
          {linkLabel}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
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
  tone?: 'light' | 'dark'; // background tone
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid gap-px overflow-hidden rounded-3xl',
        tone === 'dark' ? 'bg-white/10' : 'bg-pif-navy-100',
        stats.length === 4 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3',
        className,
      )}
    >
      {stats.map((s) => (
        <div
          key={s.label}
          className={cn('px-6 py-8 text-center', tone === 'dark' ? 'bg-pif-navy-800' : 'bg-pif-mist')}
        >
          <div
            className={cn(
              'font-heading text-4xl font-bold',
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
}: {
  image: SiteImage;
  width?: number;
  priority?: boolean;
  aspect?: string;
  scrim?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-3xl shadow-xl shadow-pif-navy/15 ring-1 ring-pif-navy/10',
        aspect,
        className,
      )}
    >
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
    <section className="relative overflow-hidden pif-grad-brand py-20 md:py-28">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.12),transparent_70%)]" />
      <Container className="relative text-center">
        <h2 className="mx-auto max-w-3xl font-heading text-[clamp(1.875rem,3.5vw,2.75rem)] font-semibold leading-tight text-white text-balance">
          {title}
        </h2>
        {subtitle && (
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-white/85">{subtitle}</p>
        )}
        <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
          <Link href={primary.href}>
            <Button
              size="lg"
              className="w-full gap-2 bg-white font-semibold text-pif-navy-800 shadow-lg hover:bg-pif-mist sm:w-auto"
            >
              {primary.label}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          {secondary && (
            <Link href={secondary.href}>
              <Button
                size="lg"
                variant="outline"
                className="w-full border-white/50 bg-transparent font-semibold text-white hover:bg-white/10 sm:w-auto"
              >
                {secondary.label}
              </Button>
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
              <path d="M5 10.5 8.5 14 15 6.5" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
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
