import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@crm-eco/ui';
import { 
  User, 
  Mail, 
  Phone, 
  Building2,
  ArrowLeft,
  Users,
  Ticket,
  HeartPulse,
  Shield,
  Calendar,
  Activity,
} from 'lucide-react';
import { getRoleQueryContext } from '@/lib/auth';
import { AdvisorStatusBadge, MemberStatusBadge, NeedStatusBadge, TicketStatusBadge } from '@/components/shared/status-badge';
import { UrgencyBadge } from '@/components/shared/urgency-badge';
import { PriorityBadge } from '@/components/shared/priority-badge';
import { ActivityTable } from '@/components/shared/activity-table';
import type { Database } from '@crm-eco/lib/types';

type Advisor = Database['public']['Tables']['advisors']['Row'];
type Member = Database['public']['Tables']['members']['Row'];
type Need = Database['public']['Tables']['needs']['Row'];
type TicketRow = Database['public']['Tables']['tickets']['Row'];

interface PageProps {
  params: { id: string };
}

async function getAdvisor(id: string): Promise<Advisor | null> {
  const supabase = await createServerSupabaseClient();
  const context = await getRoleQueryContext();
  
  if (!context) return null;

  // Role check: only owner/admin/staff can view advisor details
  if (!context.isAdmin && context.role !== 'staff') {
    return null;
  }

  const { data, error } = await supabase
    .from('advisors')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error || !data) return null;
  return data as Advisor;
}

async function getAdvisorMembers(advisorId: string): Promise<Member[]> {
  const supabase = await createServerSupabaseClient();
  
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('advisor_id', advisorId)
    .order('created_at', { ascending: false });

  if (error) return [];
  return data as Member[];
}

async function getAdvisorTickets(advisorId: string): Promise<TicketRow[]> {
  const supabase = await createServerSupabaseClient();
  
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('advisor_id', advisorId)
    .order('created_at', { ascending: false });

  if (error) return [];
  return data as TicketRow[];
}

async function getAdvisorNeeds(advisorId: string): Promise<Need[]> {
  const supabase = await createServerSupabaseClient();
  
  const { data, error } = await supabase
    .from('needs')
    .select('*')
    .eq('advisor_id', advisorId)
    .order('created_at', { ascending: false });

  if (error) return [];
  return data as Need[];
}

async function getAdvisorActivities(advisorId: string) {
  const supabase = await createServerSupabaseClient();
  
  const { data, error } = await supabase
    .from('activities')
    .select('*, profiles:created_by_profile_id(full_name)')
    .eq('advisor_id', advisorId)
    .order('occurred_at', { ascending: false })
    .limit(50);

  if (error) return [];
  return data || [];
}

function formatCurrency(amount: number | string | null): string {
  if (amount === null) return '$0';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export default async function AdvisorDetailPage({ params }: PageProps) {
  const advisor = await getAdvisor(params.id);
  
  if (!advisor) {
    notFound();
  }

  const [members, tickets, needs, activities] = await Promise.all([
    getAdvisorMembers(params.id),
    getAdvisorTickets(params.id),
    getAdvisorNeeds(params.id),
    getAdvisorActivities(params.id),
  ]);

  // Calculate KPIs
  const activeMembers = members.filter(m => m.status === 'active').length;
  const openTickets = tickets.filter(t => ['open', 'in_progress', 'waiting'].includes(t.status)).length;
  const openNeeds = needs.filter(n => ['open', 'in_review', 'processing'].includes(n.status)).length;

  const licenseStates = advisor.license_states || [];

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link 
        href="/advisors" 
        className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back to Advisors
      </Link>

      {/* Advisor Overview Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center">
                <User className="w-8 h-8 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl">
                  {advisor.first_name} {advisor.last_name}
                </CardTitle>
                {advisor.advisor_code && (
                  <p className="text-slate-500">Code: {advisor.advisor_code}</p>
                )}
              </div>
            </div>
            <AdvisorStatusBadge status={advisor.status} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Email</p>
                <p className="font-medium">{advisor.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Phone</p>
                <p className="font-medium">{advisor.phone || '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Agency</p>
                <p className="font-medium">{advisor.agency_name || '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Contract Date</p>
                <p className="font-medium">
                  {advisor.contract_date 
                    ? format(new Date(advisor.contract_date), 'MMM d, yyyy')
                    : '—'}
                </p>
              </div>
            </div>
          </div>

          {/* License States */}
          {licenseStates.length > 0 && (
            <div className="mt-6 pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-500 mb-2">Licensed States</p>
              <div className="flex flex-wrap gap-2">
                {licenseStates.map((state) => (
                  <Badge key={state} variant="secondary" className="bg-blue-50 text-blue-700">
                    {state}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Members</p>
                <p className="text-3xl font-bold text-slate-900">{members.length}</p>
                <p className="text-xs text-slate-400">{activeMembers} active</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-xl">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Open Tickets</p>
                <p className="text-3xl font-bold text-slate-900">{openTickets}</p>
                <p className="text-xs text-slate-400">{tickets.length} total</p>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl">
                <Ticket className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-rose-500">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Open Needs</p>
                <p className="text-3xl font-bold text-slate-900">{openNeeds}</p>
                <p className="text-xs text-slate-400">{needs.length} total</p>
              </div>
              <div className="p-3 bg-rose-50 rounded-xl">
                <HeartPulse className="w-6 h-6 text-rose-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="members" className="w-full">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="members" className="gap-2">
            <Users className="w-4 h-4" />
            Members ({members.length})
          </TabsTrigger>
          <TabsTrigger value="tickets" className="gap-2">
            <Ticket className="w-4 h-4" />
            Tickets ({tickets.length})
          </TabsTrigger>
          <TabsTrigger value="needs" className="gap-2">
            <HeartPulse className="w-4 h-4" />
            Needs ({needs.length})
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <Activity className="w-4 h-4" />
            Activity ({activities.length})
          </TabsTrigger>
        </TabsList>

        {/* Members Tab */}
        <TabsContent value="members" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Assigned Members</CardTitle>
            </CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="font-medium">No members assigned</p>
                  <p className="text-sm text-slate-400 mt-1">
                    Members assigned to this advisor will appear here
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Effective Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => (
                      <TableRow 
                        key={member.id} 
                        className="cursor-pointer hover:bg-slate-50"
                        onClick={() => window.location.href = `/members/${member.id}`}
                      >
                        <TableCell className="font-medium">
                          {member.first_name} {member.last_name}
                        </TableCell>
                        <TableCell>{member.email}</TableCell>
                        <TableCell>{member.state || '—'}</TableCell>
                        <TableCell>
                          <MemberStatusBadge status={member.status} />
                        </TableCell>
                        <TableCell className="text-slate-500">
                          {member.effective_date 
                            ? format(new Date(member.effective_date), 'MMM d, yyyy')
                            : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tickets Tab */}
        <TabsContent value="tickets" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Support Tickets</CardTitle>
            </CardHeader>
            <CardContent>
              {tickets.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Ticket className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="font-medium">No tickets found</p>
                  <p className="text-sm text-slate-400 mt-1">
                    Tickets for this advisor will appear here
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tickets.map((ticket) => (
                      <TableRow 
                        key={ticket.id} 
                        className="cursor-pointer hover:bg-slate-50"
                        onClick={() => window.location.href = `/tickets/${ticket.id}`}
                      >
                        <TableCell className="font-medium max-w-[250px] truncate">
                          {ticket.subject}
                        </TableCell>
                        <TableCell className="capitalize">{ticket.category}</TableCell>
                        <TableCell>
                          <TicketStatusBadge status={ticket.status} />
                        </TableCell>
                        <TableCell>
                          <PriorityBadge priority={ticket.priority} />
                        </TableCell>
                        <TableCell className="text-slate-500">
                          {format(new Date(ticket.created_at), 'MMM d, yyyy')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Needs Tab */}
        <TabsContent value="needs" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Healthcare Needs</CardTitle>
            </CardHeader>
            <CardContent>
              {needs.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <HeartPulse className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="font-medium">No needs recorded</p>
                  <p className="text-sm text-slate-400 mt-1">
                    Healthcare needs for this advisor&apos;s members will appear here
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Urgency</TableHead>
                      <TableHead>Total Amount</TableHead>
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
                        <TableCell className="capitalize font-medium">
                          {need.need_type.replace(/_/g, ' ')}
                        </TableCell>
                        <TableCell>
                          <UrgencyBadge urgency={need.urgency_light} />
                        </TableCell>
                        <TableCell>{formatCurrency(need.total_amount)}</TableCell>
                        <TableCell>
                          <NeedStatusBadge status={need.status} />
                        </TableCell>
                        <TableCell className="text-slate-500">
                          {format(new Date(need.created_at), 'MMM d, yyyy')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Activity History</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityTable 
                activities={activities} 
                showEntity={true}
                emptyMessage="No activity recorded for this advisor"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

