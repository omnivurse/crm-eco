import type { Metadata } from 'next';
import { PageSection } from '@/components/page-section';

export const metadata: Metadata = {
  title: 'About | Double Helix Software',
  description: 'A purpose-built operating system for health benefits, born out of running real benefits operations.',
};

export default function AboutPage() {
  return (
    <PageSection
      eyebrow="About"
      title="Built by operators, for operators."
      lede="Double Helix Software started as the internal toolset behind a benefits advisory operation. We rebuilt every painful spreadsheet, every off-the-shelf CRM workaround, every billing and commissions hack — and shipped them as a platform any agency or TPA can license."
      cta={{ href: '/#request-access', label: 'Request access' }}
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {[
          {
            title: 'Our thesis',
            body: 'Generic CRMs don’t know what a Medicare lead is. Generic billing systems don’t know what an advisor commission is. We built both — together — so the data flows.',
          },
          {
            title: 'How we ship',
            body: 'One shared backbone. Multi-tenant by design. Schema, RLS, and identity are unified so every product feels like part of the same system rather than a stitched-together suite.',
          },
          {
            title: 'Who we serve',
            body: 'Independent benefits advisors, growing agencies, and TPAs who need a real operating system without enterprise pricing or implementation pain.',
          },
        ].map((item) => (
          <div key={item.title} className="dh-bezel h-full">
            <div className="dh-bezel-inner h-full p-7">
              <h3 className="font-heading text-base font-semibold tracking-[-0.02em] text-foreground">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </div>
          </div>
        ))}
      </div>
    </PageSection>
  );
}
