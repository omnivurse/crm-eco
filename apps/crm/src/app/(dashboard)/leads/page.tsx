import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge } from '@crm-eco/ui';
import { UserPlus, Users, CheckCircle, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import type { Database } from '@crm-eco/lib/types';
import { CreateLeadDialog } from '@/components/leads/create-lead-dialog';
import { getRoleQueryContext } from '@/lib/auth';

type Lead = Database['public']['Tables']['leads']['Row'];

interface LeadWithAdvisor extends Lead {
  advisors?: { first_name: string; last_name: string } | null;
}

async function getLeads(): Promise<LeadWithAdvisor[]> {
  const supabase = await createServerSupabaseClient();
  const context = await getRoleQueryContext();
  
  if (!context) {
    console.error('No role context found');
    return [];
  }
  
  let query = supabase
    .from('leads')
    .select('*, advisors(first_name, last_name)')
    .order('created_at', { ascending: false });

  // Filter by advisor if user is an advisor
  if (!context.isAdmin && context.role === 'advisor' && context.advisorId) {
    query = query.eq('advisor_id', context.advisorId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching leads:', error);
    return [];
  }

  return (data ?? []) as LeadWithAdvisor[];
}

async function getLeadStats(advisorId: string | null, isAdmin: boolean) {
  const supabase = await createServerSupabaseClient();
  
  // Build base queries with optional advisor filter
  const buildQuery = (status?: string) => {
    let query = supabase.from('leads').select('id', { count: 'exact', head: true });
    if (!isAdmin && advisorId) {
      query = query.eq('advisor_id', advisorId);
    }
    if (status) {
      query = query.eq('status', status);
    }
    return query;
  };

  const [totalResult, newResult, qualifiedResult, convertedResult] = await Promise.all([
    buildQuery(),
    buildQuery('new'),
    buildQuery('qualified'),
    buildQuery('converted'),
  ]);

  return {
    total: totalResult.count ?? 0,
    new: newResult.count ?? 0,
    qualified: qualifiedResult.count ?? 0,
    converted: convertedResult.count ?? 0,
  };
}

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case 'new':
      return 'default';
    case 'contacted':
      return 'secondary';
    case 'working':
      return 'warning';
    case 'qualified':
      return 'success';
    case 'converted':
      return 'success';
    case 'unqualified':
    case 'lost':
      return 'destructive';
    default:
      return 'outline';
  }
}

function getSourceLabel(source: string | null) {
  if (!source) return '-';
  const labels: Record<string, string> = {
    website: 'Website',
    referral: 'Referral',
    call_center: 'Call Center',
    social: 'Social Media',
    event: 'Event',
    partner: 'Partner',
    other: 'Other',
  };
  return labels[source] || source;
}

export default async function LeadsPage() {
  const context = await getRoleQueryContext();
  const advisorId = context?.advisorId ?? null;
  const isAdmin = context?.isAdmin ?? false;
  
  const [leads, stats] = await Promise.all([
    getLeads(),
    getLeadStats(advisorId, isAdmin),
  ]);

  const statCards = [
    { label: 'Total Leads', value: stats.total, icon: Users, color: 'text-slate-600' },
    { label: 'New', value: stats.new, icon: UserPlus, color: 'text-blue-600' },
    { label: 'Qualified', value: stats.qualified, icon: CheckCircle, color: 'text-amber-600' },
    { label: 'Converted', value: stats.converted, icon: TrendingUp, color: 'text-emerald-600' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Leads</h1>
          <p className="text-slate-600">Track and convert potential members</p>
        </div>
        <CreateLeadDialog />
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                  <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-full bg-slate-100 ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Leads</CardTitle>
        </CardHeader>
        <CardContent>
          {leads.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <UserPlus className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-600 mb-2">No leads yet</p>
              <p className="text-sm text-slate-500">
                Click "Add Lead" to create your first lead, or they will appear here when captured from enrollment forms.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Advisor</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">
                      {lead.first_name} {lead.last_name}
                    </TableCell>
                    <TableCell>{lead.email}</TableCell>
                    <TableCell>{lead.phone ?? '-'}</TableCell>
                    <TableCell>{lead.state ?? '-'}</TableCell>
                    <TableCell>{getSourceLabel(lead.source)}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(lead.status)}>
                        {lead.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {lead.advisors
                        ? `${lead.advisors.first_name} ${lead.advisors.last_name}`
                        : '-'}
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {format(new Date(lead.created_at), 'MMM d, yyyy')}
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
