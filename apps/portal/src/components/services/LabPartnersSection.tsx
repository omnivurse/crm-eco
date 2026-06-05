import { mergeLabServiceProviders } from '@/lib/labs/merge-providers';
import { ServiceProviderGrid, type ServiceProvider } from './ServiceProviderGrid';

interface LabPartnersSectionProps {
  dbProviders: ServiceProvider[];
}

/** Lab partner directory — DB rows plus OYL / Health Cost Labs fallbacks. */
export function LabPartnersSection({ dbProviders }: LabPartnersSectionProps) {
  const providers = mergeLabServiceProviders(dbProviders);

  return (
    <section aria-labelledby="lab-partners-heading">
      <div className="mb-4">
        <h2 id="lab-partners-heading" className="text-lg font-semibold text-slate-900">
          Lab partners
        </h2>
        <p className="mt-0.5 text-sm text-slate-600">
          Order affordable tests through our curated lab partners.
        </p>
      </div>
      <ServiceProviderGrid providers={providers} />
    </section>
  );
}
