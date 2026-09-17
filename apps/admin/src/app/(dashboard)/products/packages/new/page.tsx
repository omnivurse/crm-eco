import { EntityPageHeader } from '@/components/ui/EntityPageHeader';
import { PackageForm } from '@/components/packages/PackageForm';

export default function NewPackagePage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <EntityPageHeader
        backHref="/products/packages"
        backLabel="Packages"
        title="Add package"
        description="Prepaid bundle with remaining units for the portal shop"
      />
      <PackageForm />
    </div>
  );
}
