import Link from 'next/link';
import { Flask, Info, Receipt } from '@phosphor-icons/react/dist/ssr';
import { Button } from '@crm-eco/ui/components/button';
import { listServiceProvidersByCategory } from '@/lib/data/services';
import { RecommendedLabsSection } from '@/components/services/RecommendedLabsSection';
import { LabPartnersSection } from '@/components/services/LabPartnersSection';
import { PageHeader } from '@/components/PageHeader';
import { Bezel } from '@/components/ui/Bezel';

export const dynamic = 'force-dynamic';

export default async function LabsPage() {
  const dbProviders = await listServiceProvidersByCategory('labs');

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <PageHeader
        title="Labs & testing"
        description="Affordable lab tests, blood work, and curated bundles through Own Your Labs and Health Cost Labs."
        kicker="Services"
        backHref="/services"
        backLabel="Back to Services"
        actions={
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(11,109,133,0.08)] text-[var(--mp-teal)]">
            <Flask weight="light" className="h-6 w-6" aria-hidden />
          </span>
        }
      />

      <Bezel>
        <div className="p-5 md:p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--mp-ink)]">
            <Info weight="light" className="h-4 w-4 text-[var(--mp-teal)]" aria-hidden />
            Sharing eligibility
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Lab tests exceeding your IUA may not be eligible for sharing. Confirm pricing with your advisor
            before booking expensive panels. After you pay, keep your receipt — you can attach it when you{' '}
            <Link
              href="/needs/new"
              className="font-medium text-[var(--mp-teal)] underline-offset-2 hover:underline"
            >
              submit a sharing need
            </Link>
            .
          </p>
        </div>
      </Bezel>

      <RecommendedLabsSection />

      <LabPartnersSection dbProviders={dbProviders} />

      <Bezel>
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between md:p-6">
          <div className="flex items-start gap-3">
            <Receipt weight="light" className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden />
            <div>
              <p className="font-medium text-[var(--mp-ink)]">Already had labs done?</p>
              <p className="mt-0.5 text-sm text-slate-600">
                Submit a need for sharing review with your itemized bill or receipt.
              </p>
            </div>
          </div>
          <Button asChild className="shrink-0 bg-[var(--mp-teal)] hover:bg-[var(--mp-teal-soft)]">
            <Link href="/needs/new">Submit a sharing need</Link>
          </Button>
        </div>
      </Bezel>
    </div>
  );
}
