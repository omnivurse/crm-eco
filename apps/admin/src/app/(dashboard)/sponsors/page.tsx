import { Buildings, Plus } from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';
import { Badge, Button, Card, CardContent } from '@crm-eco/ui';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { getActiveTenant } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export default async function SponsorsPage() {
  const tenant = await getActiveTenant();
  const supabase = await createServerSupabaseClient();

  let sponsors: Array<{
    id: string;
    name: string;
    status: string;
    billing_email: string | null;
    enrollment_cutoff_day: number;
    backbill_months: number;
  }> = [];
  let schemaMissing = false;

  if (tenant) {
    const { data, error } = await (supabase as any)
      .from('sponsors')
      .select('id, name, status, billing_email, enrollment_cutoff_day, backbill_months')
      .eq('organization_id', tenant.organizationId)
      .order('name');

    if (error?.message?.includes('does not exist') || error?.code === '42P01') {
      schemaMissing = true;
    } else {
      sponsors = data ?? [];
    }
  }

  const activeCount = sponsors.filter((s) => s.status === 'active').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sponsors"
        description="Employers that pay for employee memberships"
        icon={<Buildings weight="light" className="h-6 w-6" />}
        gradient="from-[var(--adm-teal)] to-[var(--adm-cyan)]"
        actions={
          <Link href="/sponsors/new">
            <Button size="sm">
              <Plus weight="light" className="mr-1.5 h-4 w-4" />
              Add sponsor
            </Button>
          </Link>
        }
      />

      {schemaMissing && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6 text-sm text-amber-900">
            Sponsor tables are in the repo migration and have not been applied to this database yet.
            No production write has been made.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="pt-5 pb-5">
            <p className="text-sm text-slate-500">Sponsors</p>
            <p className="text-2xl font-semibold">{sponsors.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-5">
            <p className="text-sm text-slate-500">Active</p>
            <p className="text-2xl font-semibold">{activeCount}</p>
          </CardContent>
        </Card>
      </div>

      {sponsors.length === 0 && !schemaMissing ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-600">
            No sponsors yet. Create one, attach a landing page, then import the roster.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Cutoff</th>
                <th className="px-4 py-3 font-medium">Backbill</th>
                <th className="px-4 py-3 font-medium">Billing email</th>
              </tr>
            </thead>
            <tbody>
              {sponsors.map((sponsor) => (
                <tr key={sponsor.id} className="border-t">
                  <td className="px-4 py-3">
                    <Link href={`/sponsors/${sponsor.id}`} className="font-medium text-teal-700 hover:underline">
                      {sponsor.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={sponsor.status === 'active' ? 'default' : 'secondary'}>{sponsor.status}</Badge>
                  </td>
                  <td className="px-4 py-3">Day {sponsor.enrollment_cutoff_day}</td>
                  <td className="px-4 py-3">{sponsor.backbill_months} mo</td>
                  <td className="px-4 py-3 text-slate-600">{sponsor.billing_email || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
