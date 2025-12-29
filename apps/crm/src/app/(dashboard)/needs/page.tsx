import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge, Input } from '@crm-eco/ui';
import { CreateNeedDialog } from '@/components/needs/create-need-dialog';
import { Search, HeartPulse, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import type { Database } from '@crm-eco/lib/types';
import { getRoleQueryContext } from '@/lib/auth';

type Need = Database['public']['Tables']['needs']['Row'];

interface NeedWithMember extends Need {
  members?: { first_name: string; last_name: string; advisor_id: string | null } | null;
}

async function getNeeds(): Promise<NeedWithMember[]> {
  const supabase = await createServerSupabaseClient();
  const context = await getRoleQueryContext();
  
  if (!context) {
    console.error('No role context found');
    return [];
  }
  
  let query = supabase
    .from('needs')
    .select('*, members(first_name, last_name, advisor_id)')
    .order('created_at', { ascending: false });

  // For advisors, filter to needs where they are the advisor or the member's advisor
  if (!context.isAdmin && context.role === 'advisor' && context.advisorId) {
    // Filter by advisor_id on the need itself, or filter by member's advisor_id
    query = query.or(`advisor_id.eq.${context.advisorId},members.advisor_id.eq.${context.advisorId}`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching needs:', error);
    return [];
  }

  // If advisor, also filter client-side for members that belong to them
  // (since the members.advisor_id filter in Supabase might not work perfectly with nested filters)
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

const statusColors: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700 border-blue-200',
  in_review: 'bg-amber-100 text-amber-700 border-amber-200',
  processing: 'bg-purple-100 text-purple-700 border-purple-200',
  paid: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  closed: 'bg-slate-100 text-slate-500 border-slate-200',
};

const urgencyColors: Record<string, { bg: string; text: string; label: string }> = {
  green: { bg: 'bg-emerald-500', text: 'text-white', label: 'Normal' },
  orange: { bg: 'bg-amber-500', text: 'text-white', label: 'Medium' },
  red: { bg: 'bg-red-500', text: 'text-white', label: 'Urgent' },
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function NeedsPage() {
  const needs = await getNeeds();
  
  const openCount = needs.filter(n => n.status === 'open').length;
  const inReviewCount = needs.filter(n => n.status === 'in_review').length;
  const totalEligible = needs.reduce((sum, n) => sum + Number(n.eligible_amount), 0);
  const totalReimbursed = needs.reduce((sum, n) => sum + Number(n.reimbursed_amount), 0);

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
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-slate-900">{formatCurrency(totalEligible)}</div>
            <p className="text-sm text-slate-500">Total Eligible</p>
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
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search needs..." 
              className="pl-9 h-9"
            />
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
                {needs.map((need) => {
                  const urgency = urgencyColors[need.urgency_light] || urgencyColors.green;
                  return (
                    <TableRow key={need.id} className="cursor-pointer hover:bg-slate-50">
                      <TableCell>
                        <div className="font-medium text-slate-900">
                          {need.members
                            ? `${need.members.first_name} ${need.members.last_name}`
                            : '—'}
                        </div>
                      </TableCell>
                      <TableCell className="capitalize text-slate-600">
                        {need.need_type.replace('_', ' ')}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${urgency.bg} ${urgency.text}`}>
                          {urgency.label}
                        </span>
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
                        <Badge 
                          variant="outline"
                          className={statusColors[need.status] || statusColors.closed}
                        >
                          {need.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-400 text-sm">
                        {format(new Date(need.created_at), 'MMM d, yyyy')}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
