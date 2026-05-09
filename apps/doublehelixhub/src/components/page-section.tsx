import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

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
    <main className="container-page py-20">
      {eyebrow && (
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">{eyebrow}</p>
      )}
      <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
        {title}
      </h1>
      {lede && <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{lede}</p>}
      {children && <div className="mt-10">{children}</div>}
      {cta && (
        <Link
          href={cta.href}
          className="mt-12 inline-flex h-11 items-center justify-center rounded-md gradient-helix px-6 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
        >
          {cta.label} <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      )}
    </main>
  );
}
