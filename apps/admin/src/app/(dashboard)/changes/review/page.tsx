import { ClipboardText, Tray } from '@phosphor-icons/react/dist/ssr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from '@crm-eco/ui';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getActiveTenant } from '@/lib/tenant';
import { PageHeader } from '@/components/ui/PageHeader';

const PAGE_SIZE = 50;

// Statuses that still need an admin decision. The DB CHECK on
// member_change_requests.status uses 'pending_review' (not 'pending'/'needs_review');
// the prior values matched nothing, so the queue was always empty.
const PENDING_STATUSES = ['pending_review'];

interface ChangeRequestRow {
  id: string;
  request_type: string;
  status: string;
  payload: unknown;
  decision_notes: string | null;
  created_at: string;
  updated_at: string;
  member: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    member_number: string | null;
  } | null;
}

async function getPendingChangeRequests(): Promise<ChangeRequestRow[]> {
  const supabase = await createServerSupabaseClient();
  const tenant = await getActiveTenant();
  if (!tenant) return [];

  const { data, error } = await supabase
    .from('member_change_requests')
    .select(`
      id,
      request_type,
      status,
      payload,
      decision_notes,
      created_at,
      updated_at,
      member:members(id, first_name, last_name, email, member_number)
    `)
    .eq('organization_id', tenant.organizationId)
    .in('status', PENDING_STATUSES)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);

  if (error) {
    console.error('Error fetching member change requests:', error);
    return [];
  }

  return (data ?? []) as unknown as ChangeRequestRow[];
}

function formatLabel(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusVariant(status: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (status) {
    case 'pending_review':
      return 'secondary';
    case 'rejected':
    case 'withdrawn':
      return 'destructive';
    case 'approved':
    case 'completed':
      return 'default';
    default:
      return 'outline';
  }
}

function memberName(member: ChangeRequestRow['member']): string {
  if (!member) return 'Unknown member';
  const name = [member.first_name, member.last_name].filter(Boolean).join(' ').trim();
  return name || member.email || member.member_number || 'Unknown member';
}

function summarizePayload(payload: unknown): string {
  if (payload == null || typeof payload !== 'object') return '';
  const keys = Object.keys(payload as Record<string, unknown>);
  if (keys.length === 0) return '';
  return keys.slice(0, 6).map(formatLabel).join(', ');
}

export default async function ChangesReviewPage() {
  const requests = await getPendingChangeRequests();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pending Changes"
        description="Review and decide on member change requests awaiting approval"
        icon={<ClipboardText weight="light" className="w-6 h-6" />}
        
      />

      <Card>
        <CardHeader>
          <CardTitle>Change Requests</CardTitle>
          <CardDescription>
            {requests.length === 0
              ? 'No requests awaiting review'
              : `${requests.length.toLocaleString()} request${requests.length === 1 ? '' : 's'} awaiting review`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-slate-100 p-4">
                <Tray weight="light" className="w-8 h-8 text-slate-400" />
              </div>
              <p className="mt-4 text-sm font-medium text-slate-900">All caught up</p>
              <p className="mt-1 text-sm text-slate-500">
                There are no pending or needs-review change requests right now.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2">Member</th>
                    <th className="px-3 py-2">Request Type</th>
                    <th className="px-3 py-2">Changes</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requests.map((req) => {
                    const summary = summarizePayload(req.payload);
                    return (
                      <tr key={req.id} className="hover:bg-slate-50">
                        <td className="px-3 py-3">
                          <div className="font-medium text-slate-900">{memberName(req.member)}</div>
                          {req.member?.member_number && (
                            <div className="text-xs text-slate-500">#{req.member.member_number}</div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-slate-700">{formatLabel(req.request_type)}</td>
                        <td className="px-3 py-3 text-slate-500">
                          {summary || <span className="text-slate-400">—</span>}
                          {req.decision_notes && (
                            <div className="mt-1 text-xs text-slate-400">{req.decision_notes}</div>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <Badge variant={statusVariant(req.status)}>{formatLabel(req.status)}</Badge>
                        </td>
                        <td className="px-3 py-3 text-slate-500">
                          {new Date(req.created_at).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
