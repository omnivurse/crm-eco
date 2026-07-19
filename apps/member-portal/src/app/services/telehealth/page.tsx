import { Stethoscope, Info } from '@phosphor-icons/react/dist/ssr';
import { listServiceProvidersByCategory } from '@/lib/data/services';
import { ServiceProviderGrid } from '@/components/services/ServiceProviderGrid';
import { PageHeader } from '@/components/PageHeader';
import { Bezel } from '@/components/ui/Bezel';

export const dynamic = 'force-dynamic';

export default async function TelehealthPage() {
  const providers = await listServiceProvidersByCategory('telehealth');

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <PageHeader
        title="Telehealth"
        description="Connect with licensed providers 24/7 — included with your membership."
        kicker="Services"
        backHref="/services"
        backLabel="Back to Services"
        actions={
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(11,109,133,0.08)] text-[var(--mp-teal)]">
            <Stethoscope weight="light" className="h-6 w-6" aria-hidden />
          </span>
        }
      />

      <Bezel>
        <div className="p-5 md:p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--mp-ink)]">
            <Info weight="light" className="h-4 w-4 text-[var(--mp-teal)]" aria-hidden />
            What&apos;s covered
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Coverage limits vary by plan. Most virtual urgent-care visits are included with
            no co-pay; behavioral health and specialty consults may have separate caps.
            Always confirm with your advisor before scheduling specialty visits.
          </p>
        </div>
      </Bezel>

      <ServiceProviderGrid
        providers={providers}
        ssoEnabled
        emptyMessage="Telehealth partners haven't been configured for your plan yet. Contact support."
      />
    </div>
  );
}
