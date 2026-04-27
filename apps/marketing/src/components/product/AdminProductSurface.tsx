'use client';

import { ProductHero } from '@/components/product/ProductHero';
import { ProductFeatureGrid } from '@/components/product/ProductFeatureGrid';
import { ProductWorkflow } from '@/components/product/ProductWorkflow';
import { CtaSection } from '@/components/sections/CtaSection';
import {
  IconUsers,
  IconId,
  IconReceipt,
  IconHandCoins,
  IconChart,
  IconStrategy,
  IconList,
  IconBuilding,
  IconShield,
} from '@/components/icons';

const features = [
  {
    icon: IconUsers,
    title: 'Member directory of record',
    body: 'A canonical record per member: enrollment history, dependents, eligibility, and audit trail — never lost in a CSV again.',
  },
  {
    icon: IconId,
    title: 'Plans, products & pricing',
    body: 'Configure plan structures, age-banded rates, riders, and effective dates with versioned pricing matrices.',
  },
  {
    icon: IconReceipt,
    title: 'Billing & NACHA',
    body: 'Recurring billing, retries, declined-card workflows, and NACHA file generation with reconciliation reports.',
  },
  {
    icon: IconHandCoins,
    title: 'Commissions engine',
    body: 'Tiered commission structures, hierarchy overrides, and signed payout statements — with full audit history.',
  },
  {
    icon: IconChart,
    title: 'Actuarial & demographics',
    body: 'Cohort, retention, and experience reports out of the box. Export raw rows or rendered PDFs.',
  },
  {
    icon: IconList,
    title: 'Saved views & bulk ops',
    body: 'Filter once, save forever. Bulk assign, bulk message, bulk export — every action audit-logged.',
  },
  {
    icon: IconStrategy,
    title: 'Operations & scheduler',
    body: 'Job runner for eligibility, age-up/age-out, retro adjustments, and reconciliation — observable end-to-end.',
  },
  {
    icon: IconBuilding,
    title: 'Per-tenant theming',
    body: 'Run subsidiaries under one license. Branded subdomain, isolated data, separate audit log per tenant.',
  },
  {
    icon: IconShield,
    title: 'Granular role permissions',
    body: 'Owner, admin, staff, and read-only seats. Permission overrides at the resource level when you need them.',
  },
];

const steps = [
  {
    code: '/01',
    title: 'Onboard the tenant',
    body: 'Spin up a new organization, assign a subdomain, brand it, and seed initial plan products and rate cards.',
  },
  {
    code: '/02',
    title: 'Enroll members',
    body: 'Capture enrollments via the CRM, advisor portal, or self-service link. All routes write to the same record.',
  },
  {
    code: '/03',
    title: 'Bill & reconcile',
    body: 'Recurring billing runs automatically; declined cards enter a retry workflow; NACHA files export on schedule.',
  },
  {
    code: '/04',
    title: 'Pay & report',
    body: 'Commission payouts generate, statements deliver, and actuarial reports refresh nightly into the dashboard.',
  },
];

export function AdminProductSurface() {
  return (
    <>
      <ProductHero
        code="01"
        name="Admin"
        tone="cyan"
        eyebrow="Member management & enrollment"
        title={
          <>
            The system of record for{' '}
            <span className="text-gradient-helix">healthcare members</span>.
          </>
        }
        description="From enrollment through billing, commissions, and renewal — Admin is the multi-tenant operating layer for organizations that move members at scale."
        primaryHref="/contact?intent=admin-demo"
        primaryLabel="Book an Admin demo"
        secondaryHref="/crm"
        secondaryLabel="See the CRM"
        highlights={[
          { value: '60%', label: 'Faster cycle' },
          { value: '< 48h', label: 'New tenant' },
          { value: '99.99%', label: 'Uptime' },
        ]}
      />

      <ProductFeatureGrid
        eyebrow="Capabilities"
        tone="cyan"
        title={
          <>
            Everything you need to run a{' '}
            <span className="text-gradient-helix">member organization</span>.
          </>
        }
        description="Every Admin feature is built on the same multi-tenant foundation, audit-logged, and exposed through a stable API."
        features={features}
      />

      <ProductWorkflow
        eyebrow="Operating loop"
        tone="cyan"
        title={
          <>
            From new tenant to paid commission in{' '}
            <span className="text-gradient-helix">four steps</span>.
          </>
        }
        steps={steps}
      />

      <CtaSection
        eyebrow="See Admin in action"
        title={
          <>
            Run Admin against{' '}
            <span className="text-gradient-helix">your member data</span>.
          </>
        }
        description="We bring synthetic copies of your records. You bring your hardest workflow. 30 minutes to a working prototype."
        primaryHref="/contact?intent=admin-demo"
        primaryLabel="Book an Admin demo"
        secondaryHref="/crm"
        secondaryLabel="Compare with CRM"
      />
    </>
  );
}
