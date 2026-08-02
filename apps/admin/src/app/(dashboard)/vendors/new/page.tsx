import { VendorForm } from '@/components/vendors/VendorForm';
import { EntityPageHeader } from '@/components/ui/EntityPageHeader';

export default function NewVendorPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <EntityPageHeader
        backHref="/vendors"
        backLabel="Vendors"
        title="Add new vendor"
        description="Configure a new vendor integration"
      />

      {/* Form */}
      <VendorForm />
    </div>
  );
}
