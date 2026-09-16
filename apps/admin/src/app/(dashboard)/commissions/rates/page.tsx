import { Percent, Plus } from '@phosphor-icons/react/dist/ssr';
import { Card, CardContent, Button, Badge } from '@crm-eco/ui';
import Link from 'next/link';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { getActiveTenant } from '@/lib/tenant';

interface CommissionRate {
  id: string;
  organization_id: string;
  signup_commission: number | null;
  signup_commission_percent: number | null;
  monthly_commission: number | null;
  monthly_commission_percent: number | null;
  override_commission_percent: number | null;
  is_active: boolean | null;
  effective_date: string | null;
  end_date: string | null;
  notes: string | null;
}

async function getRates(): Promise<CommissionRate[]> {
  const supabase = await createServerSupabaseClient();
  const tenant = await getActiveTenant();
  if (!tenant) return [];

  const { data, error } = await (supabase.from('commission_rates') as any)
    .select('*')
    .eq('organization_id', tenant.organizationId)
    .order('effective_date', { ascending: false });

  if (error) {
    console.error('Error fetching commission rates:', error);
    return [];
  }
  return data || [];
}

export default async function CommissionRatesPage() {
  const rates = await getRates();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Commission rates"
        description="Rate card used when enrollments are approved. Empty rates mean signup commissions stay $0."
        actions={
          <Link href="/commissions/rates/new">
            <Button size="sm">
              <Plus weight="light" className="mr-1.5 h-4 w-4" aria-hidden />
              Add rate
            </Button>
          </Link>
        }
      />

      {rates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Percent weight="light" className="h-12 w-12 mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No commission rates</h3>
            <p className="text-slate-500 mb-4 max-w-lg mx-auto">
              Advisor revenue reports stay at $0 until a rate card exists. Add a tenant rate
              before approving new enrollments. Historical imported actives are not backfilled.
            </p>
            <Link href="/commissions/rates/new">
              <Button>
                <Plus weight="light" className="h-4 w-4 mr-2" />
                Create first rate
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rates.map((rate) => (
            <Link key={rate.id} href={`/commissions/rates/${rate.id}`}>
              <Card className="hover:border-emerald-300 transition-colors">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-900">
                      {rate.notes?.trim() || 'Default rate'}
                    </p>
                    <Badge variant={rate.is_active ? 'default' : 'secondary'}>
                      {rate.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-slate-500">Signup %</dt>
                      <dd className="font-medium">{rate.signup_commission_percent ?? 0}%</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Signup $</dt>
                      <dd className="font-medium">{rate.signup_commission ?? 0}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Monthly %</dt>
                      <dd className="font-medium">{rate.monthly_commission_percent ?? 0}%</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Override %</dt>
                      <dd className="font-medium">{rate.override_commission_percent ?? 0}%</dd>
                    </div>
                  </dl>
                  {rate.effective_date && (
                    <p className="text-xs text-slate-400">Effective {rate.effective_date}</p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
