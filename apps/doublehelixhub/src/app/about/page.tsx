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
      <div className="grid gap-10 lg:grid-cols-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Our thesis</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Generic CRMs don&rsquo;t know what a Medicare lead is. Generic billing systems don&rsquo;t
            know what an advisor commission is. We built both — together — so the data flows.
          </p>
        </div>
        <div>
          <h3 className="text-base font-semibold text-foreground">How we ship</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            One shared backbone. Multi-tenant by design. Schema, RLS, and identity are unified so
            every product feels like part of the same system rather than a stitched-together suite.
          </p>
        </div>
        <div>
          <h3 className="text-base font-semibold text-foreground">Who we serve</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Independent benefits advisors, growing agencies, and TPAs who need a real operating
            system without enterprise pricing or implementation pain.
          </p>
        </div>
      </div>
    </PageSection>
  );
}
