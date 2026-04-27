'use client';

import { ProductHero } from '@/components/product/ProductHero';
import { ProductFeatureGrid } from '@/components/product/ProductFeatureGrid';
import { ProductWorkflow } from '@/components/product/ProductWorkflow';
import { CtaSection } from '@/components/sections/CtaSection';
import {
  IconBriefcase,
  IconFunnel,
  IconTree,
  IconSend,
  IconClick,
  IconList,
  IconBolt,
  IconShield,
  IconBrain,
  IconReceipt,
} from '@/components/icons';

const features = [
  {
    icon: IconFunnel,
    title: 'Lead capture & routing',
    body: 'Web forms, inbound calls, and partner feeds land in one inbox. Automated assignment by territory, license state, or round-robin.',
  },
  {
    icon: IconTree,
    title: 'Advisor hierarchy & overrides',
    body: 'Multi-level upline structures with split commissions, overrides, and per-advisor performance roll-ups.',
  },
  {
    icon: IconClick,
    title: 'Pipeline & deal stages',
    body: 'Customisable Kanban pipelines per product line. Stage automations trigger emails, tasks, and notifications.',
  },
  {
    icon: IconSend,
    title: 'E-signature enrollment',
    body: 'Send a signed enrollment packet in minutes. Documents flow into the member record on the Admin side automatically.',
  },
  {
    icon: IconBriefcase,
    title: 'Advisor portal',
    body: 'A branded, mobile-friendly portal where advisors run their book, see pending deals, and pull commission statements.',
  },
  {
    icon: IconBrain,
    title: 'AI-assisted notes',
    body: 'Call summaries, follow-up drafts, and next-action prompts generated from your CRM context — never the open internet.',
  },
  {
    icon: IconReceipt,
    title: 'Quote-to-enroll',
    body: 'Generate quotes against the same product catalogue used by Admin. One click converts a winning quote into a member.',
  },
  {
    icon: IconList,
    title: 'Activities & tasks',
    body: 'Calls, emails, SMS, and tasks in a unified timeline per lead, member, and advisor — searchable and exportable.',
  },
  {
    icon: IconShield,
    title: 'Compliance audit trail',
    body: 'Every customer-facing communication captured against the record. Built for state regulators, not against them.',
  },
  {
    icon: IconBolt,
    title: 'Workflow automations',
    body: 'No-code rules: triggers, conditions, and actions. Tied to the same event bus as Admin — no integration glue required.',
  },
];

const steps = [
  {
    code: '/01',
    title: 'Capture',
    body: 'Leads land from web, phone, partner, or import. Auto-assigned to the right advisor by territory and license state.',
  },
  {
    code: '/02',
    title: 'Qualify',
    body: 'Advisors run discovery in the pipeline. Activities, notes, and AI summaries roll up to a single timeline view.',
  },
  {
    code: '/03',
    title: 'Quote',
    body: 'Pull from the live product catalogue and generate a comparison quote. Send for e-signature in two clicks.',
  },
  {
    code: '/04',
    title: 'Enroll',
    body: 'Signed enrollment becomes a member record on the Admin side. Commissions credit automatically.',
  },
];

export function CrmProductSurface() {
  return (
    <>
      <ProductHero
        code="02"
        name="CRM"
        tone="violet"
        eyebrow="Sales, advisor & enrollment automation"
        title={
          <>
            Where leads become{' '}
            <span className="text-gradient-helix">enrolled members</span>.
          </>
        }
        description="A pipeline CRM tuned for advisor-led healthcare distribution. Native to the Admin platform, so every signed enrollment lands as a clean member record — no glue code."
        primaryHref="/contact?intent=crm-demo"
        primaryLabel="Book a CRM demo"
        secondaryHref="/admin"
        secondaryLabel="See the Admin"
        highlights={[
          { value: '3.4x', label: 'Faster quote' },
          { value: '92%', label: 'Capture rate' },
          { value: '< 2 min', label: 'Lead to advisor' },
        ]}
      />

      <ProductFeatureGrid
        eyebrow="Capabilities"
        tone="violet"
        title={
          <>
            A modern sales surface for{' '}
            <span className="text-gradient-helix">advisor networks</span>.
          </>
        }
        description="Built for the realities of distributed advisor operations: hierarchy, licensing, compliance, and high-velocity quoting."
        features={features}
      />

      <ProductWorkflow
        eyebrow="Pipeline loop"
        tone="violet"
        title={
          <>
            Capture, qualify, quote, enroll — in{' '}
            <span className="text-gradient-helix">one continuous flow</span>.
          </>
        }
        steps={steps}
      />

      <CtaSection
        eyebrow="See CRM in action"
        title={
          <>
            Watch a lead become a member in{' '}
            <span className="text-gradient-helix">under 30 minutes</span>.
          </>
        }
        description="A working session against synthetic data. Bring your hardest funnel — we will show how Capture → Quote → Enroll runs end-to-end."
        primaryHref="/contact?intent=crm-demo"
        primaryLabel="Book a CRM demo"
        secondaryHref="/admin"
        secondaryLabel="Compare with Admin"
      />
    </>
  );
}
