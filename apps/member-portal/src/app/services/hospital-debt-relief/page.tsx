import { Buildings, ShieldCheck } from '@phosphor-icons/react/dist/ssr';
import { listServiceProvidersByCategory } from '@/lib/data/services';
import { ServiceProviderGrid } from '@/components/services/ServiceProviderGrid';
import { PageHeader } from '@/components/PageHeader';
import { Bezel } from '@/components/ui/Bezel';

export const dynamic = 'force-dynamic';

export default async function HospitalDebtReliefPage() {
  const providers = await listServiceProvidersByCategory('hospital_debt_relief');

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <PageHeader
        title="Hospital debt relief"
        description="Negotiate or eliminate hospital debt accumulated before joining."
        kicker="Services"
        backHref="/services"
        backLabel="Back to Services"
        actions={
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(11,109,133,0.08)] text-[var(--mp-teal)]">
            <Buildings weight="light" className="h-6 w-6" aria-hidden />
          </span>
        }
      />

      <Bezel>
        <div className="p-5 md:p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--mp-ink)]">
            <ShieldCheck weight="light" className="h-4 w-4 text-[var(--mp-teal)]" aria-hidden />
            Quick eligibility check
          </h2>
          <ul className="mt-3 ml-5 list-disc space-y-1.5 text-sm text-slate-700">
            <li>Has the bill been outstanding for more than 90 days?</li>
            <li>Did the service occur before your membership effective date?</li>
            <li>Is the original balance over $500?</li>
            <li>Have you already contacted the billing department?</li>
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            If you answered yes to two or more, you likely qualify. Visit a partner below to start the application.
          </p>
        </div>
      </Bezel>

      <ServiceProviderGrid providers={providers} />
    </div>
  );
}
