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
  MapPin, 
  Calendar, 
  Shield, 
  UserCheck,
  ArrowLeft,
  HeartPulse,
  Ticket,
} from 'lucide-react';
import { getRoleQueryContext } from '@/lib/auth';
import { MemberStatusBadge, NeedStatusBadge, TicketStatusBadge } from '@/components/shared/status-badge';
import { UrgencyBadge } from '@/components/shared/urgency-badge';
import { PriorityBadge } from '@/components/shared/priority-badge';
import type { Database } from '@crm-eco/lib/types';

type Member = Database['public']['Tables']['members']['Row'];
type Need = Database['public']['Tables']['needs']['Row'];
type TicketRow = Database['public']['Tables']['tickets']['Row'];

interface MemberWithAdvisor extends Member {
  advisors?: { id: string; first_name: string; last_name: string } | null;
}

interface PageProps {
  params: { id: string };
}

async function getMember(id: string): Promise<MemberWithAdvisor | null> {
  const supabase = await createServerSupabaseClient();
  const context = await getRoleQueryContext();
  
  if (!context) return null;

  // Build query with filters
  let query = supabase
    .from('members')
    .select('*, advisors(id, first_name, last_name)')
    .eq('id', id);

  // Role check: advisors can only see their assigned members
  if (!context.isAdmin && context.role === 'advisor' && context.advisorId) {
    query = query.eq('advisor_id', context.advisorId);
  }

  const { data, error } = await query.single();
  
  if (error || !data) return null;
  return data as MemberWithAdvisor;
}

async function getMemberNeeds(memberId: string): Promise<Need[]> {
  const supabase = await createServerSupabaseClient();
  
  const { data, error } = await supabase
    .from('needs')
    .select('*')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false });

  if (error) return [];
  return data as Need[];
}

async function getMemberTickets(memberId: string): Promise<TicketRow[]> {
  const supabase = await createServerSupabaseClient();
  
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false });

  if (error) return [];
  return data as TicketRow[];
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

export default async function MemberDetailPage({ params }: PageProps) {
  const member = await getMember(params.id);
  
  if (!member) {
    notFound();
  }

  const [needs, tickets] = await Promise.all([
    getMemberNeeds(params.id),
    getMemberTickets(params.id),
  ]);

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link 
        href="/members" 
        className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back to Members
      </Link>

      {/* Member Overview Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                <User className="w-8 h-8 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl">
                  {member.first_name} {member.last_name}
                </CardTitle>
                {member.member_number && (
                  <p className="text-slate-500">Member #{member.member_number}</p>
                )}
              </div>
            </div>
            <MemberStatusBadge status={member.status} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Email</p>
                <p className="font-medium">{member.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Phone</p>
                <p className="font-medium">{member.phone || '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Location</p>
                <p className="font-medium">
                  {member.city && member.state 
                    ? `${member.city}, ${member.state}`
                    : member.state || '—'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <UserCheck className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Advisor</p>
                <p className="font-medium">
                  {member.advisors 
                    ? (
                      <Link 
                        href={`/advisors/${member.advisors.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {member.advisors.first_name} {member.advisors.last_name}
                      </Link>
                    )
                    : '—'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="needs" className="gap-2">
            <HeartPulse className="w-4 h-4" />
            Needs ({needs.length})
          </TabsTrigger>
          <TabsTrigger value="tickets" className="gap-2">
            <Ticket className="w-4 h-4" />
            Tickets ({tickets.length})
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Personal Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="w-5 h-5 text-slate-400" />
                  Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-slate-500">Date of Birth</span>
                  <span className="font-medium">
                    {member.date_of_birth 
                      ? format(new Date(member.date_of_birth), 'MMM d, yyyy')
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Gender</span>
                  <span className="font-medium capitalize">{member.gender || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Marital Status</span>
                  <span className="font-medium capitalize">{member.marital_status || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Household Role</span>
                  <span className="font-medium capitalize">{member.household_role || '—'}</span>
                </div>
              </CardContent>
            </Card>

            {/* Coverage Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="w-5 h-5 text-slate-400" />
                  Coverage Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-slate-500">Program Type</span>
                  <span className="font-medium capitalize">{member.program_type || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Coverage Type</span>
                  <span className="font-medium capitalize">{member.coverage_type || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Effective Date</span>
                  <span className="font-medium">
                    {member.effective_date 
                      ? format(new Date(member.effective_date), 'MMM d, yyyy')
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Renewal Month</span>
                  <span className="font-medium">
                    {member.renewal_month 
                      ? format(new Date(2024, member.renewal_month - 1), 'MMMM')
                      : '—'}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Address Card */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-slate-400" />
                  Address
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-slate-500">Address Line 1</p>
                    <p className="font-medium">{member.address_line1 || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Address Line 2</p>
                    <p className="font-medium">{member.address_line2 || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">City</p>
                    <p className="font-medium">{member.city || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">State</p>
                    <p className="font-medium">{member.state || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Postal Code</p>
                    <p className="font-medium">{member.postal_code || '—'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
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
                    Healthcare needs for this member will appear here
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
                    Support tickets for this member will appear here
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
      </Tabs>
    </div>
  );
}

