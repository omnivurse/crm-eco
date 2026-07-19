import { Tag } from '@phosphor-icons/react/dist/ssr';
import { listServiceProvidersByCategory } from '@/lib/data/services';
import { ServiceProviderGrid } from '@/components/services/ServiceProviderGrid';
import { PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export default async function DiscountsPage() {
  const providers = await listServiceProvidersByCategory('discount');
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <PageHeader
        title="Discounts"
        description="Member-only savings on pharmacy, vision, dental, fitness, and more."
        kicker="Services"
        backHref="/services"
        backLabel="Back to Services"
        actions={
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(11,109,133,0.08)] text-[var(--mp-teal)]">
            <Tag weight="light" className="h-6 w-6" aria-hidden />
          </span>
        }
      />
      <ServiceProviderGrid providers={providers} />
    </div>
  );
}
