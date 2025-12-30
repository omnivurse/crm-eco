import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@crm-eco/ui';
import { CreateNeedDialog } from '@/components/needs/create-need-dialog';
import { Search, HeartPulse, DollarSign, Filter, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import type { Database } from '@crm-eco/lib/types';
import { getRoleQueryContext } from '@/lib/auth';
import { NeedStatusBadge } from '@/components/shared/status-badge';
import { UrgencyBadge } from '@/components/shared/urgency-badge';
import { getUrgencyLabelCRM } from '@crm-eco/lib';

type Need = Database['public']['Tables']['needs']['Row'];

interface NeedWithMember extends Need {
  members?: { id: string; first_name: string; last_name: string; advisor_id: string | null } | null;
}

interface PageProps {
  searchParams: { status?: string; sla?: string };
}

async function getNeeds(statusFilter?: string, slaFilter?: string): Promise<NeedWithMember[]> {
  const supabase = await createServerSupabaseClient();
  const context = await getRoleQueryContext();
  
  if (!context) {
    console.error('No role context found');
    return [];
  }
  
  let query = supabase
    .from('needs')
    .select('*, members(id, first_name, last_name, advisor_id)')
    .order('target_completion_date', { ascending: true, nullsFirst: false });

  // Apply filters
  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }
  if (slaFilter && slaFilter !== 'all') {
    query = query.eq('urgency_light', slaFilter);
  }

  // For advisors, filter to needs where they are the advisor or the member's advisor
  if (!context.isAdmin && context.role === 'advisor' && context.advisorId) {
    query = query.or(`advisor_id.eq.${context.advisorId},members.advisor_id.eq.${context.advisorId}`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching needs:', error);
    return [];
  }

  // If advisor, also filter client-side for members that belong to them
  let filteredData = data ?? [];
  if (!context.isAdmin && context.role === 'advisor' && context.advisorId) {
    filteredData = filteredData.filter(
      (need: NeedWithMember) => 
        need.advisor_id === context.advisorId || 
        need.members?.advisor_id === context.advisorId
    );
  }

  return filteredData as NeedWithMember[];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// SLA Tab component
function SLATab({ 
  label, 
  count, 
  value, 
  active, 
  icon: Icon,
  colorClass
}: { 
  label: string; 
  count: number; 
  value: string; 
  active: boolean;
  icon: React.ElementType;
  colorClass: string;
}) {
  return (
    <Link
      href={value === 'all' ? '/needs' : `/needs?sla=${value}`}
      className={`
        flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all
        ${active 
          ? `${colorClass} shadow-sm` 
          : 'text-slate-600 hover:bg-slate-100'
        }
      `}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
      <span className={`
        ml-1 px-2 py-0.5 rounded-full text-xs font-semibold
        ${active ? 'bg-white/20' : 'bg-slate-200 text-slate-600'}
      `}>
        {count}
      </span>
    </Link>
  );
}

export default async function NeedsPage({ searchParams }: PageProps) {
  // For SLA tabs, we need all needs to compute counts, then filter for display
  const allNeeds = await getNeeds(searchParams.status);
  
  // Compute SLA counts
  const overdueCount = allNeeds.filter(n => n.urgency_light === 'red').length;
  const atRiskCount = allNeeds.filter(n => n.urgency_light === 'orange').length;
  const onTrackCount = allNeeds.filter(n => n.urgency_light === 'green').length;
  
  // Filter by SLA if specified
  const slaFilter = searchParams.sla;
  const needs = slaFilter && slaFilter !== 'all'
    ? allNeeds.filter(n => n.urgency_light === slaFilter)
    : allNeeds;
  
  const totalReimbursed = needs.reduce((sum, n) => sum + Number(n.reimbursed_amount), 0);

  // Determine active tab
  const activeTab = slaFilter || 'all';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-500">Manage member healthcare needs and reimbursements</p>
        </div>
        <CreateNeedDialog />
      </div>

      {/* SLA Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Link href="/needs" className="block">
          <Card className={`border-l-4 border-l-blue-500 hover:shadow-md transition-shadow cursor-pointer ${activeTab === 'all' ? 'ring-2 ring-blue-500' : ''}`}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-slate-900">{allNeeds.length}</div>
                  <p className="text-sm text-slate-500">Total Needs</p>
                </div>
                <HeartPulse className="w-8 h-8 text-blue-500 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/needs?sla=green" className="block">
          <Card className={`border-l-4 border-l-emerald-500 hover:shadow-md transition-shadow cursor-pointer ${activeTab === 'green' ? 'ring-2 ring-emerald-500' : ''}`}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-slate-900">{onTrackCount}</div>
                  <p className="text-sm text-slate-500">{getUrgencyLabelCRM('green')}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-emerald-500 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/needs?sla=orange" className="block">
          <Card className={`border-l-4 border-l-amber-500 hover:shadow-md transition-shadow cursor-pointer ${activeTab === 'orange' ? 'ring-2 ring-amber-500' : ''}`}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-slate-900">{atRiskCount}</div>
                  <p className="text-sm text-slate-500">{getUrgencyLabelCRM('orange')}</p>
                </div>
                <Clock className="w-8 h-8 text-amber-500 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/needs?sla=red" className="block">
          <Card className={`border-l-4 border-l-red-500 hover:shadow-md transition-shadow cursor-pointer ${activeTab === 'red' ? 'ring-2 ring-red-500' : ''}`}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-slate-900">{overdueCount}</div>
                  <p className="text-sm text-slate-500">{getUrgencyLabelCRM('red')}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-500 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* SLA Queue Tabs */}
      <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-lg w-fit">
        <SLATab 
          label="All" 
          count={allNeeds.length} 
          value="all" 
          active={activeTab === 'all'}
          icon={HeartPulse}
          colorClass="bg-blue-600 text-white"
        />
        <SLATab 
          label="On Track" 
          count={onTrackCount} 
          value="green" 
          active={activeTab === 'green'}
          icon={CheckCircle}
          colorClass="bg-emerald-600 text-white"
        />
        <SLATab 
          label="At-Risk" 
          count={atRiskCount} 
          value="orange" 
          active={activeTab === 'orange'}
          icon={Clock}
          colorClass="bg-amber-500 text-white"
        />
        <SLATab 
          label="Overdue" 
          count={overdueCount} 
          value="red" 
          active={activeTab === 'red'}
          icon={AlertTriangle}
          colorClass="bg-red-600 text-white"
        />
      </div>

      {/* Needs Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <HeartPulse className="w-5 h-5 text-slate-400" />
            {activeTab === 'all' ? 'All Need Requests' : `${getUrgencyLabelCRM(activeTab as 'green' | 'orange' | 'red')} Needs`}
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <form className="flex items-center gap-2">
                <Select name="status" defaultValue={searchParams.status || 'all'}>
                  <SelectTrigger className="w-44 h-9">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="intake">Intake</SelectItem>
                    <SelectItem value="awaiting_member_docs">Awaiting Member Docs</SelectItem>
                    <SelectItem value="awaiting_provider_docs">Awaiting Provider Docs</SelectItem>
                    <SelectItem value="in_review">In Review</SelectItem>
                    <SelectItem value="pricing">Pricing</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="reimbursement_pending">Reimbursement Pending</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="denied">Denied</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </form>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Search needs..." 
                className="pl-9 h-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {needs.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <HeartPulse className="w-8 h-8 text-purple-500" />
              </div>
              <p className="font-medium text-slate-700 mb-2">
                {activeTab === 'all' 
                  ? 'No needs recorded yet' 
                  : `No ${getUrgencyLabelCRM(activeTab as 'green' | 'orange' | 'red').toLowerCase()} needs`}
              </p>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                {activeTab === 'all' 
                  ? 'Healthcare needs will be tracked here for reimbursement processing. Click "Create Need" to add a new need request.'
                  : `There are no needs currently in the "${getUrgencyLabelCRM(activeTab as 'green' | 'orange' | 'red')}" queue.`}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Need Type</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead>Target Date</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Eligible</TableHead>
                  <TableHead>Reimbursed</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {needs.map((need) => (
                  <TableRow 
                    key={need.id} 
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => window.location.href = `/needs/${need.id}`}
                  >
                    <TableCell>
                      {need.members ? (
                        <Link 
                          href={`/members/${need.members.id}`}
                          className="font-medium text-blue-600 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {need.members.first_name} {need.members.last_name}
                        </Link>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="capitalize text-slate-600">
                      {need.need_type.replace(/_/g, ' ')}
                    </TableCell>
                    <TableCell>
                      <UrgencyBadge urgency={need.urgency_light} />
                    </TableCell>
                    <TableCell className="text-slate-600 text-sm">
                      {need.sla_target_date 
                        ? format(new Date(need.sla_target_date), 'MMM d, yyyy')
                        : <span className="text-slate-400">—</span>
                      }
                    </TableCell>
                    <TableCell className="text-slate-900 font-medium">
                      {formatCurrency(Number(need.total_amount))}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {formatCurrency(Number(need.eligible_amount))}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-emerald-600 font-medium">
                          {formatCurrency(Number(need.reimbursed_amount))}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <NeedStatusBadge status={need.status} />
                    </TableCell>
                    <TableCell className="text-slate-400 text-sm">
                      {format(new Date(need.created_at), 'MMM d, yyyy')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
