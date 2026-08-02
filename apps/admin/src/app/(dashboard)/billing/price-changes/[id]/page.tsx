import { Calendar, Play, X } from '@phosphor-icons/react/dist/ssr';
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from '@crm-eco/ui';
import { EntityPageHeader } from '@/components/ui/EntityPageHeader';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getActiveTenant } from '@/lib/tenant';

interface ScheduleRow {
  id: string;
  scheduled_date: string;
  status: string;
  affected_enrollments_count: number | null;
  processed_count: number | null;
  failed_count: number | null;
  notes: string | null;
  created_at: string;
  executed_at: string | null;
  old_pricing_snapshot: { monthly_share?: number } | null;
  new_pricing_snapshot: { monthly_share?: number } | null;
  error_log: unknown;
  plans?: { name: string | null } | null;
}

interface AuditRow {
  id: string;
  enrollment_id: string;
  old_amount: number | null;
  new_amount: number | null;
  applied_at: string;
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

async function getSchedule(id: string): Promise<ScheduleRow | null> {
  const supabase = await createServerSupabaseClient();
  const tenant = await getActiveTenant();
  if (!tenant) return null;

  const { data } = await supabase
    .from('price_change_schedules')
    .select(`
      id, scheduled_date, status, affected_enrollments_count, processed_count, failed_count,
      notes, created_at, executed_at, old_pricing_snapshot, new_pricing_snapshot, error_log,
      plans(name)
    `)
    .eq('id', id)
    .eq('organization_id', tenant.organizationId)
    .single();

  return (data as unknown as ScheduleRow) ?? null;
}

async function getAuditTrail(scheduleId: string): Promise<AuditRow[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from('price_change_audit')
    .select('id, enrollment_id, old_amount, new_amount, applied_at')
    .eq('schedule_id', scheduleId)
    .order('applied_at', { ascending: false })
    .limit(100);
  return (data ?? []) as AuditRow[];
}

export default async function PriceChangeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const schedule = await getSchedule(id);
  if (!schedule) notFound();

  const audit = await getAuditTrail(id);
  const oldAmount = schedule.old_pricing_snapshot?.monthly_share ?? 0;
  const newAmount = schedule.new_pricing_snapshot?.monthly_share ?? 0;
  const delta = newAmount - oldAmount;
  const errorLog = Array.isArray(schedule.error_log) ? schedule.error_log : [];

  return (
    <div className="space-y-6">
      <EntityPageHeader
        backHref="/billing/price-changes"
        backLabel="Price changes"
        title="Price change"
        subtitle={schedule.plans?.name ?? 'Unknown plan'}
        badges={statusBadge(schedule.status)}
        primaryAction={
          schedule.status === 'pending' ? (
            <form action={`/api/price-changes/${id}/execute`} method="POST">
              <Button type="submit" size="sm">
                <Play weight="light" className="mr-2 h-4 w-4" />
                Execute now
              </Button>
            </form>
          ) : undefined
        }
        secondaryActions={
          schedule.status === 'pending' ? (
            <form action={`/api/price-changes/${id}/cancel`} method="POST">
              <Button type="submit" variant="outline" size="sm">
                <X weight="light" className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </form>
          ) : undefined
        }
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge>{schedule.status}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Scheduled Date</span>
              <span className="font-medium">{format(new Date(schedule.scheduled_date), 'MMM d, yyyy')}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{format(new Date(schedule.created_at), 'MMM d, yyyy')}</span>
            </div>
            {schedule.executed_at && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Executed</span>
                <span>{format(new Date(schedule.executed_at), 'MMM d, yyyy h:mm a')}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pricing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Old Amount</span>
              <span className="font-medium">${oldAmount.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">New Amount</span>
              <span className="font-medium">${newAmount.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between border-t pt-2">
              <span className="text-muted-foreground">Delta</span>
              <span className={`font-medium ${delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {delta >= 0 ? '+' : ''}${delta.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Affected</span>
              <span>{schedule.affected_enrollments_count ?? 0} enrollments</span>
            </div>
            {schedule.processed_count != null && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Processed</span>
                <span>{schedule.processed_count} ({schedule.failed_count ?? 0} failed)</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {schedule.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{schedule.notes}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Audit Trail</CardTitle>
        </CardHeader>
        <CardContent>
          {audit.length === 0 ? (
            <p className="text-sm text-muted-foreground">No audit entries yet</p>
          ) : (
            <div className="space-y-2">
              {audit.map((row) => (
                <div key={row.id} className="flex items-center justify-between rounded border p-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar weight="light" className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">{format(new Date(row.applied_at), 'MMM d h:mm a')}</span>
                    <Link href={`/enrollments/${row.enrollment_id}`} className="font-mono text-xs text-blue-600 hover:underline">
                      {row.enrollment_id.slice(0, 8)}
                    </Link>
                  </div>
                  <div>
                    ${(row.old_amount ?? 0).toFixed(2)} → <strong>${(row.new_amount ?? 0).toFixed(2)}</strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {errorLog.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-auto rounded bg-red-50 p-3 text-xs text-red-800">
              {JSON.stringify(errorLog, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
