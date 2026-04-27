'use client';

import { Container } from '@/components/primitives/Container';
import { SectionHeading } from '@/components/primitives/SectionHeading';
import { IconPlug } from '@/components/icons';

const integrations = [
  'Stripe', 'Authorize.net', 'NACHA', 'Twilio', 'GoTo Connect',
  'Resend', 'OneDrive', 'DocuSign', 'Supabase', 'Postgres', 'Webhooks', 'REST API',
];

export function IntegrationsSection() {
  return (
    <section id="integrations" className="section-tight relative overflow-hidden border-y border-white/[0.06]">
      <Container>
        <div className="grid items-center gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <SectionHeading
              align="left"
              eyebrow="Integrations"
              title="Drops into your stack."
              description="We don't fight your existing tools — we slot in alongside them. First-class connectors, signed webhooks, and a stable API surface."
            />
          </div>

          <div className="relative lg:col-span-8">
            <div
              className="mask-fade-x flex gap-3 overflow-hidden"
              style={{ maskImage: 'linear-gradient(90deg, transparent, black 8%, black 92%, transparent)' }}
            >
              <div className="flex shrink-0 animate-marquee-x gap-3">
                {[...integrations, ...integrations].map((i, idx) => (
                  <span
                    key={`${i}-${idx}`}
                    className="inline-flex items-center gap-2 whitespace-nowrap rounded-full glass px-4 py-2 text-sm text-white/85"
                  >
                    <IconPlug size={14} weight="duotone" className="text-helix-cyan-200" />
                    {i}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
