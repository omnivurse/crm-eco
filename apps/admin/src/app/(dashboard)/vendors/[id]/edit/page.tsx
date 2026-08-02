import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { VendorForm } from '@/components/vendors/VendorForm';
import { EntityPageHeader } from '@/components/ui/EntityPageHeader';
import { getActiveTenant } from '@/lib/tenant';

async function getVendor(id: string) {
  const supabase = await createServerSupabaseClient();

  const tenant = await getActiveTenant();
  if (!tenant) return null;
  const { data: vendor } = await (supabase as any)
    .from('vendors')
    .select('*')
    .eq('id', id)
    .eq('org_id', tenant.organizationId)
    .single();

  return vendor;
}

export default async function EditVendorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const vendor = await getVendor(id);

  if (!vendor) {
    notFound();
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <EntityPageHeader
        backHref={`/vendors/${vendor.id}`}
        backLabel={vendor.name}
        title="Edit vendor"
        description={`Update ${vendor.name} settings`}
      />

      {/* Form */}
      <VendorForm initialData={vendor} />
    </div>
  );
}
