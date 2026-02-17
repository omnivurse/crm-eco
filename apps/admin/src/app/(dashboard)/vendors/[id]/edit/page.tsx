import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@crm-eco/ui';
import { ArrowLeft } from 'lucide-react';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { VendorForm } from '@/components/vendors/VendorForm';

async function getVendor(id: string) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single() as { data: { organization_id: string } | null };

  if (!profile) return null;

  const { data: vendor } = await (supabase as any)
    .from('vendors')
    .select('*')
    .eq('id', id)
    .eq('org_id', profile.organization_id)
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
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/vendors/${vendor.id}`}>
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Edit Vendor</h1>
          <p className="text-slate-500 mt-0.5">
            Update {vendor.name} settings
          </p>
        </div>
      </div>

      {/* Form */}
      <VendorForm initialData={vendor} />
    </div>
  );
}
