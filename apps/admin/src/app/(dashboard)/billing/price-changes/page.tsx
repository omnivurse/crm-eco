import { Calendar, Plus, TrendDown, TrendUp } from '@phosphor-icons/react/dist/ssr';
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from '@crm-eco/ui';
import Link from 'next/link';
import { format } from 'date-fns';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getActiveTenant } from '@/lib/tenant';

interface PriceChangeRow {
  id: string;
  scheduled_date: string;
  status: string;
  affected_enrollments_count: number | null;
  processed_count: number | null;
  failed_count: number | null;
  notes: string | null;
  created_at: string;
  plans?: { name: string | null } | null;
}

async function getSchedules(): Promise<PriceChangeRow[]> {
  const supabase = await createServerSupabaseClient();
  const tenant = await getActiveTenant();
  if (!tenant) return [];

  const { data } = await supabase
    .from('price_change_schedules')
    .select('id, scheduled_date, status, affected_enrollments_count, processed_count, failed_count, notes, created_at, plans(name)')
    .eq('organization_id', tenant.organizationId)
    .order('scheduled_date', { ascending: false })
    .limit(50);

  return (data ?? []) as unknown as PriceChangeRow[];
}

function statusBadge(status: string) {
  switch (status) {
    case 'pending':    return <Badge variant="secondary">Pending</Badge>;
    case 'processing': return <Badge variant="secondary">Processing</Badge>;
    case 'completed':  return <Badge>Completed</Badge>;
    case 'failed':     return <Badge variant="destructive">Failed</Badge>;
    case 'cancelled':  return <Badge variant="outline">Cancelled</Badge>;
    default:           return <Badge variant="outline">{status}</Badge>;
  }
}

export default async function PriceChangesPage() {
  const schedules = await getSchedules();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Price Changes</h1>
          <p className="text-sm text-muted-foreground">Schedule and track plan price changes</p>
        </div>
        <Link href="/billing/price-changes/new">
          <Button>
            <Plus weight="light" className="mr-2 h-4 w-4" />
            Schedule Price Change
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Price Change Schedules</CardTitle>
        </CardHeader>
        <CardContent>
          {schedules.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <TrendUp weight="light" className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">No price changes scheduled</p>
            </div>
          ) : (
            <div className="space-y-3">
              {schedules.map((s) => (
                <Link
                  key={s.id}
                  href={`/billing/price-changes/${s.id}`}
                  className="block rounded-lg border p-4 transition hover:bg-accent"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {s.processed_count && s.processed_count > 0 ? (
                        <TrendUp weight="light" className="h-5 w-5 text-blue-500" />
                      ) : (
                        <TrendDown weight="light" className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div>
                        <div className="font-medium">{s.plans?.name ?? 'Unknown plan'}</div>
                        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar weight="light" className="h-3 w-3" />
                            {format(new Date(s.scheduled_date), 'MMM d, yyyy')}
                          </span>
                          {s.affected_enrollments_count != null && (
                            <span>{s.affected_enrollments_count} enrollments</span>
                          )}
                          {s.processed_count != null && s.processed_count > 0 && (
                            <span>{s.processed_count} processed{s.failed_count ? `, ${s.failed_count} failed` : ''}</span>
                          )}
                        </div>
                        {s.notes && <div className="mt-1 text-xs text-muted-foreground">{s.notes}</div>}
                      </div>
                    </div>
                    {statusBadge(s.status)}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
