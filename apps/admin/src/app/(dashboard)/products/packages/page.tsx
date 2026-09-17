import { Package, Plus } from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';
import { Badge, Button, Card, CardContent } from '@crm-eco/ui';
import { createServerSupabaseClient, createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { getActiveTenant } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export default async function PackagesPage() {
  const tenant = await getActiveTenant();
  const supabase = tenant ? (createServiceRoleClient() as any) : await createServerSupabaseClient();

  let packages: Array<{
    id: string;
    name: string;
    sku: string | null;
    price: number;
    units: number;
    unit_label: string;
    is_active: boolean;
  }> = [];
  let schemaMissing = false;

  if (tenant) {
    const { data, error } = await supabase
      .from('packages')
      .select('id, name, sku, price, units, unit_label, is_active')
      .eq('organization_id', tenant.organizationId)
      .order('name');
    if (error?.message?.includes('does not exist') || error?.code === '42P01') {
      schemaMissing = true;
    } else {
      packages = data ?? [];
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Packages"
        description="Prepaid bundles with remaining units. Not a recurring membership."
        icon={<Package weight="light" className="h-6 w-6" />}
        gradient="from-[var(--adm-teal)] to-[var(--adm-cyan)]"
        actions={
          <Link href="/products/packages/new">
            <Button size="sm">
              <Plus weight="light" className="mr-1.5 h-4 w-4" />
              Add package
            </Button>
          </Link>
        }
      />

      {schemaMissing && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6 text-sm text-amber-900">
            Package tables could not be read from this database. If this is a new environment, apply
            the membership_packages_shop migration. Live PIF-ECO-V2 already has these tables.
          </CardContent>
        </Card>
      )}

      {packages.length === 0 && !schemaMissing ? (
        <Card>
          <CardContent className="pt-6 text-sm text-slate-500">
            No packages yet. Create one to sell prepaid visits or units in the member portal shop.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {packages.map((row) => (
            <Link key={row.id} href={`/products/packages/${row.id}`}>
              <Card className="hover:border-slate-300">
                <CardContent className="flex items-center justify-between gap-3 pt-5 pb-5">
                  <div>
                    <p className="font-medium">{row.name}</p>
                    <p className="text-sm text-slate-500">
                      {row.units} {row.unit_label}
                      {row.sku ? ` · ${row.sku}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">${Number(row.price).toFixed(2)}</p>
                    <Badge variant={row.is_active ? 'default' : 'secondary'}>
                      {row.is_active ? 'active' : 'inactive'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
