import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { format, formatDistanceToNow } from 'date-fns';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@crm-eco/ui';
import { 
  ArrowLeft,
  HeartPulse,
  Calendar,
  Clock,
  DollarSign,
  Users,
  UserCheck,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Activity,
} from 'lucide-react';
import { getRoleQueryContext } from '@/lib/auth';
import { NeedStatusBadge } from '@/components/shared/status-badge';
import { UrgencyBadge, getUrgencyText } from '@/components/shared/urgency-badge';
import { ActivityTable } from '@/components/shared/activity-table';
import type { Database } from '@crm-eco/lib/types';

type Need = Database['public']['Tables']['needs']['Row'];
type NeedEvent = Database['public']['Tables']['need_events']['Row'];

interface NeedWithRelations extends Need {
  members?: { id: string; first_name: string; last_name: string } | null;
  advisors?: { id: string; first_name: string; last_name: string } | null;
}

interface NeedEventWithProfile extends NeedEvent {
  profiles?: { full_name: string } | null;
}

interface PageProps {
  params: { id: string };
}

async function getNeed(id: string): Promise<NeedWithRelations | null> {
  const supabase = await createServerSupabaseClient();
  const context = await getRoleQueryContext();
  
  if (!context) return null;

  const { data, error } = await supabase
    .from('needs')
    .select(`
      *,
      members(id, first_name, last_name),
      advisors(id, first_name, last_name)
    `)
    .eq('id', id)
    .single();
  
  if (error || !data) return null;

  // Role check for advisors
  if (!context.isAdmin && context.role === 'advisor' && context.advisorId) {
    const need = data as NeedWithRelations;
    const canAccess = 
      need.advisor_id === context.advisorId ||
      need.members?.id && (await checkMemberBelongsToAdvisor(need.members.id, context.advisorId));
    
    if (!canAccess) return null;
  }

  return data as NeedWithRelations;
}

async function checkMemberBelongsToAdvisor(memberId: string, advisorId: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from('members')
    .select('advisor_id')
    .eq('id', memberId)
    .single();
  
  const memberData = data as { advisor_id: string | null } | null;
  return memberData?.advisor_id === advisorId;
}

async function getNeedEvents(needId: string): Promise<NeedEventWithProfile[]> {
  const supabase = await createServerSupabaseClient();
  
  const { data, error } = await supabase
    .from('need_events')
    .select(`
      *,
      profiles:created_by_profile_id(full_name)
    `)
    .eq('need_id', needId)
    .order('occurred_at', { ascending: false });

  if (error) return [];
  return data as NeedEventWithProfile[];
}

async function getNeedActivities(needId: string) {
  const supabase = await createServerSupabaseClient();
  
  const { data, error } = await supabase
    .from('activities')
    .select('*, profiles:created_by_profile_id(full_name)')
    .eq('need_id', needId)
    .order('occurred_at', { ascending: false })
    .limit(25);

  if (error) return [];
  return data || [];
}

function formatCurrency(amount: number | string | null): string {
  if (amount === null) return '$0';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function getEventIcon(eventType: string) {
  switch (eventType) {
    case 'status_change':
      return <ArrowRight className="w-4 h-4" />;
    case 'payment':
      return <DollarSign className="w-4 h-4" />;
    case 'document_uploaded':
      return <CheckCircle className="w-4 h-4" />;
    default:
      return <Clock className="w-4 h-4" />;
  }
}

export default async function NeedDetailPage({ params }: PageProps) {
  const need = await getNeed(params.id);
  
  if (!need) {
    notFound();
  }

  const [events, activities] = await Promise.all([
    getNeedEvents(params.id),
    getNeedActivities(params.id),
  ]);

  // Calculate financial progress
  const totalAmount = parseFloat(String(need.total_amount)) || 0;
  const eligibleAmount = parseFloat(String(need.eligible_amount)) || 0;
  const reimbursedAmount = parseFloat(String(need.reimbursed_amount)) || 0;
  const remainingAmount = eligibleAmount - reimbursedAmount;
  const progressPercent = eligibleAmount > 0 ? (reimbursedAmount / eligibleAmount) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link 
        href="/needs" 
        className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back to Needs
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Need Overview Card */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center">
                    <HeartPulse className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl capitalize">
                      {need.need_type.replace(/_/g, ' ')}
                    </CardTitle>
                    {need.members && (
                      <Link 
                        href={`/members/${need.members.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {need.members.first_name} {need.members.last_name}
                      </Link>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <UrgencyBadge urgency={need.urgency_light} />
                  <NeedStatusBadge status={need.status} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {need.description && (
                <div className="mb-6">
                  <p className="text-sm text-slate-500 mb-1">Description</p>
                  <p className="text-slate-700 whitespace-pre-wrap">{need.description}</p>
                </div>
              )}

              {/* Financial Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-xs text-slate-500">Total Amount</p>
                  <p className="text-lg font-bold text-slate-900">{formatCurrency(totalAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">IUA Amount</p>
                  <p className="text-lg font-bold text-slate-900">{formatCurrency(need.iua_amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Eligible Amount</p>
                  <p className="text-lg font-bold text-slate-900">{formatCurrency(eligibleAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Reimbursed</p>
                  <p className="text-lg font-bold text-emerald-600">{formatCurrency(reimbursedAmount)}</p>
                </div>
              </div>

              {/* Progress Bar */}
              {eligibleAmount > 0 && (
                <div className="mt-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-500">Reimbursement Progress</span>
                    <span className="font-medium">{Math.round(progressPercent)}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${Math.min(progressPercent, 100)}%` }}
                    />
                  </div>
                  {remainingAmount > 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      {formatCurrency(remainingAmount)} remaining
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Events Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-slate-400" />
                Event History ({events.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Clock className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="font-medium">No events recorded</p>
                  <p className="text-sm text-slate-400 mt-1">
                    Events will appear here as the need is processed
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Status Change</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead>By</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
                              {getEventIcon(event.event_type)}
                            </div>
                            <span className="capitalize font-medium">
                              {event.event_type.replace(/_/g, ' ')}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {event.old_status && event.new_status ? (
                            <div className="flex items-center gap-1 text-sm">
                              <span className="text-slate-400 capitalize">{event.old_status.replace(/_/g, ' ')}</span>
                              <ArrowRight className="w-3 h-3 text-slate-400" />
                              <span className="font-medium capitalize">{event.new_status.replace(/_/g, ' ')}</span>
                            </div>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-slate-600">
                          {event.note || '—'}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {event.profiles?.full_name || 'System'}
                        </TableCell>
                        <TableCell className="text-slate-500 text-sm">
                          {formatDistanceToNow(new Date(event.occurred_at), { addSuffix: true })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* SLA & Timeline Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-slate-400" />
                SLA & Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-500">Urgency</span>
                  <UrgencyBadge urgency={need.urgency_light} />
                </div>
                {need.sla_target_date && (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-500">Target Date</span>
                      <span className="font-medium">
                        {format(new Date(need.sla_target_date), 'MMM d, yyyy')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">Status</span>
                      <span className={`font-medium ${
                        need.urgency_light === 'red' ? 'text-red-600' :
                        need.urgency_light === 'orange' ? 'text-amber-600' :
                        'text-emerald-600'
                      }`}>
                        {getUrgencyText(need.sla_target_date)}
                      </span>
                    </div>
                  </>
                )}
                {!need.sla_target_date && (
                  <p className="text-sm text-slate-400">No SLA target set</p>
                )}
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-1">Incident Date</p>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <p className="font-medium">
                    {need.incident_date 
                      ? format(new Date(need.incident_date), 'MMM d, yyyy')
                      : '—'}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-1">Created</p>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <p className="font-medium">
                    {format(new Date(need.created_at), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reimbursement Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-slate-400" />
                Reimbursement
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">Method</p>
                <p className="font-medium capitalize">
                  {need.reimbursement_method?.replace(/_/g, ' ') || '—'}
                </p>
              </div>
              {need.reimbursement_account_last4 && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Account</p>
                  <p className="font-medium">•••• {need.reimbursement_account_last4}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Linked Entities */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Linked Entities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {need.members && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Member</p>
                  <Link 
                    href={`/members/${need.members.id}`}
                    className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <Users className="w-4 h-4 text-blue-600" />
                    </div>
                    <span className="font-medium text-blue-600 hover:underline">
                      {need.members.first_name} {need.members.last_name}
                    </span>
                  </Link>
                </div>
              )}

              {need.advisors && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Advisor</p>
                  <Link 
                    href={`/advisors/${need.advisors.id}`}
                    className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                      <UserCheck className="w-4 h-4 text-emerald-600" />
                    </div>
                    <span className="font-medium text-emerald-600 hover:underline">
                      {need.advisors.first_name} {need.advisors.last_name}
                    </span>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="w-5 h-5 text-slate-400" />
                Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityTable 
                activities={activities} 
                emptyMessage="No activity recorded"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

