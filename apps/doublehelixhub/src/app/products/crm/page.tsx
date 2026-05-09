import type { Metadata } from 'next';
import { PageSection } from '@/components/page-section';

export const metadata: Metadata = {
  title: 'CRM Core | Double Helix Software',
  description:
    'The CRM built for health benefits — pipelines, modules, automations, and document workflows tuned for advisors and agencies.',
};

const capabilities = [
  { title: 'Modular records', body: 'Leads, deals, accounts, plans, custom modules — define your own fields and stages per tenant org.' },
  { title: 'Email & SMS sync', body: 'Two-way Gmail/Outlook + Twilio threading attached to records, with sequences and automations.' },
  { title: 'Embeddable forms', body: 'Drop quote forms onto any tenant marketing site. Anonymous submissions land scoped to the right org.' },
  { title: 'Documents & e-sign', body: 'Generate proposals from templates, send for signature, archive against the deal record.' },
  { title: 'Automation engine', body: 'Event-driven workflows with conditions, queues, and retries. Trigger on stage change, time, or external webhook.' },
  { title: 'Audit + HIPAA-aware', body: 'Row-level security, immutable audit logs, and PHI guardrails baked into the data model.' },
];

export default function CrmProductPage() {
  return (
    <PageSection
      eyebrow="Product"
      title="CRM Core"
      lede="Run your benefits sales motion on a CRM that already knows what a Medicare lead, an ACA enrollment, or a healthshare member is. Stop bending Salesforce."
      cta={{ href: '/#request-access', label: 'Request access' }}
    >
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {capabilities.map((c) => (
          <div key={c.title} className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h3 className="text-base font-semibold text-foreground">{c.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{c.body}</p>
          </div>
        ))}
      </div>
    </PageSection>
  );
}
