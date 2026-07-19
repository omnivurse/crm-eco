import { Heart } from '@phosphor-icons/react/dist/ssr';
import { listServiceProvidersByCategory } from '@/lib/data/services';
import { ServiceProviderGrid } from '@/components/services/ServiceProviderGrid';
import { PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export default async function CarePage() {
  const providers = await listServiceProvidersByCategory('care');
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <PageHeader
        title="Care partners"
        description="Curated providers offering bundled care to members."
        kicker="Services"
        backHref="/services"
        backLabel="Back to Services"
        actions={
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(11,109,133,0.08)] text-[var(--mp-teal)]">
            <Heart weight="light" className="h-6 w-6" aria-hidden />
          </span>
        }
      />
      <ServiceProviderGrid providers={providers} />
    </div>
  );
}
