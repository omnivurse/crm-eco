'use client';

import { Container } from '@/components/primitives/Container';
import { Button } from '@/components/primitives/Button';
import { HelixCanvas } from '@/components/helix/HelixCanvas';
import { IconArrowRight } from '@/components/icons';

type CtaSectionProps = {
  eyebrow?: string;
  title?: React.ReactNode;
  description?: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

export function CtaSection({
  eyebrow = 'Ready when you are',
  title = (
    <>
      See Double Helix run on{' '}
      <span className="text-gradient-helix">your data</span>.
    </>
  ),
  description = 'A 30-minute working session: we map your enrollment & member-management workflows, demo on synthetic copies of your data, and quote a deployment plan in writing.',
  primaryHref = '/contact?intent=demo',
  primaryLabel = 'Book a demo',
  secondaryHref = '/pricing',
  secondaryLabel = 'View pricing',
}: CtaSectionProps) {
  return (
    <section className="relative overflow-hidden py-24 md:py-32">
      <div className="absolute inset-0 bg-gradient-to-b from-ink-950 via-ink-900 to-ink-950" />

      {/* Helix as ambient backdrop, far behind */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 opacity-40 [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,black,transparent_80%)]">
        <HelixCanvas height={520} speed={0.006} />
      </div>

      <Container className="relative">
        <div className="mx-auto max-w-3xl rounded-[2rem] glass-strong p-10 text-center md:p-14">
          <span className="eyebrow">
            <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-helix-cyan-300" />
            {eyebrow}
          </span>

          <h2 className="display-2 mt-5">{title}</h2>

          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-helix-mist sm:text-lg">
            {description}
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button href={primaryHref} variant="primary" size="lg">
              {primaryLabel}
              <IconArrowRight size={16} weight="bold" />
            </Button>
            <Button href={secondaryHref} variant="ghost" size="lg">
              {secondaryLabel}
            </Button>
          </div>

          <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.22em] text-helix-fog">
            No sales pressure · Custom deployments · Multi-region available
          </p>
        </div>
      </Container>
    </section>
  );
}
