import { EntityPageHeader } from '@/components/ui/EntityPageHeader';
import { SponsorForm } from '@/components/sponsors/SponsorForm';

export default function NewSponsorPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <EntityPageHeader
        backHref="/sponsors"
        backLabel="Sponsors"
        title="Add sponsor"
        description="Create an employer that can roster employees and receive one invoice"
      />
      <SponsorForm />
    </div>
  );
}
