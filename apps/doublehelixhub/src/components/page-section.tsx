import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from '@phosphor-icons/react/dist/ssr';

export function PageSection({
  eyebrow,
  title,
  lede,
  children,
  cta,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  children?: ReactNode;
  cta?: { href: string; label: string };
}) {
  return (
    <main className="container-page py-20 md:py-28">
      {eyebrow && <span className="dh-eyebrow">{eyebrow}</span>}
      <h1 className="mt-5 max-w-3xl font-heading text-[clamp(2.25rem,5vw,3.5rem)] font-bold tracking-[-0.04em] text-foreground">
        {title}
      </h1>
      {lede && <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">{lede}</p>}
      {children && <div className="mt-12">{children}</div>}
      {cta && (
        <Link href={cta.href} className="group mt-14 inline-flex dh-btn-island dh-btn-primary">
          {cta.label}
          <span className="dh-btn-ico">
            <ArrowUpRight weight="light" className="h-3.5 w-3.5" />
          </span>
        </Link>
      )}
    </main>
  );
}
