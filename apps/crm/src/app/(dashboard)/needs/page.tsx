import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@crm-eco/ui';
import { CreateNeedDialog } from '@/components/needs/create-need-dialog';
import { Search, HeartPulse, DollarSign, Filter } from 'lucide-react';
import { format } from 'date-fns';
import type { Database } from '@crm-eco/lib/types';
import { getRoleQueryContext } from '@/lib/auth';
import { NeedStatusBadge } from '@/components/shared/status-badge';
import { UrgencyBadge } from '@/components/shared/urgency-badge';

type Need = Database['public']['Tables']['needs']['Row'];

interface NeedWithMember extends Need {
  members?: { id: string; first_name: string; last_name: string; advisor_id: string | null } | null;
}

interface PageProps {
  searchParams: { status?: string; urgency?: string };
}

async function getNeeds(statusFilter?: string, urgencyFilter?: string): Promise<NeedWithMember[]> {
  const supabase = await createServerSupabaseClient();
  const context = await getRoleQueryContext();
  
  if (!context) {
    console.error('No role context found');
    return [];
  }
  
  let query = supabase
    .from('needs')
    .select('*, members(id, first_name, last_name, advisor_id)')
    .order('created_at', { ascending: false });

  // Apply filters
  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }
  if (urgencyFilter && urgencyFilter !== 'all') {
    query = query.eq('urgency_light', urgencyFilter);
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

export default async function NeedsPage({ searchParams }: PageProps) {
  const needs = await getNeeds(searchParams.status, searchParams.urgency);
  
  const openCount = needs.filter(n => n.status === 'open').length;
  const inReviewCount = needs.filter(n => n.status === 'in_review').length;
  const totalEligible = needs.reduce((sum, n) => sum + Number(n.eligible_amount), 0);
  const totalReimbursed = needs.reduce((sum, n) => sum + Number(n.reimbursed_amount), 0);

  // Count by urgency
  const urgentCount = needs.filter(n => n.urgency_light === 'red').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-500">Manage member healthcare needs and reimbursements</p>
        </div>
        <CreateNeedDialog />
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-slate-900">{needs.length}</div>
            <p className="text-sm text-slate-500">Total Needs</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-slate-900">{openCount + inReviewCount}</div>
            <p className="text-sm text-slate-500">Pending Review</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-slate-900">{urgentCount}</div>
            <p className="text-sm text-slate-500">Urgent (Red)</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-slate-900">{formatCurrency(totalReimbursed)}</div>
            <p className="text-sm text-slate-500">Total Reimbursed</p>
          </CardContent>
        </Card>
      </div>

      {/* Needs Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <HeartPulse className="w-5 h-5 text-slate-400" />
            All Need Requests
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <form className="flex items-center gap-2">
                <Select name="status" defaultValue={searchParams.status || 'all'}>
                  <SelectTrigger className="w-32 h-9">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_review">In Review</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
                <Select name="urgency" defaultValue={searchParams.urgency || 'all'}>
                  <SelectTrigger className="w-36 h-9">
                    <SelectValue placeholder="Urgency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Urgency</SelectItem>
                    <SelectItem value="green">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        On Track
                      </span>
                    </SelectItem>
                    <SelectItem value="orange">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        Near Deadline
                      </span>
                    </SelectItem>
                    <SelectItem value="red">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        Must Complete
                      </span>
                    </SelectItem>
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
              <p className="font-medium text-slate-700 mb-2">No needs recorded yet</p>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                Healthcare needs will be tracked here for reimbursement processing. Click &quot;Create Need&quot; to add a new need request.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Need Type</TableHead>
                  <TableHead>Urgency</TableHead>
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
