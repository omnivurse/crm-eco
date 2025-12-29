import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@crm-eco/ui';
import { CreateTicketDialog } from '@/components/tickets/create-ticket-dialog';
import { format } from 'date-fns';
import { Search, Ticket, Filter } from 'lucide-react';
import type { Database } from '@crm-eco/lib/types';
import { getRoleQueryContext } from '@/lib/auth';
import { TicketStatusBadge } from '@/components/shared/status-badge';
import { PriorityBadge } from '@/components/shared/priority-badge';
import { CategoryBadge } from '@/components/shared/category-badge';

type TicketRow = Database['public']['Tables']['tickets']['Row'];

interface TicketWithRelations extends TicketRow {
  created_by?: { full_name: string } | null;
  assigned_to?: { full_name: string } | null;
  members?: { id: string; first_name: string; last_name: string } | null;
}

interface PageProps {
  searchParams: { status?: string; category?: string };
}

async function getTickets(statusFilter?: string, categoryFilter?: string): Promise<TicketWithRelations[]> {
  const supabase = await createServerSupabaseClient();
  const context = await getRoleQueryContext();
  
  if (!context) {
    console.error('No role context found');
    return [];
  }
  
  let query = supabase
    .from('tickets')
    .select(`
      *,
      created_by:profiles!tickets_created_by_profile_id_fkey(full_name),
      assigned_to:profiles!tickets_assigned_to_profile_id_fkey(full_name),
      members(id, first_name, last_name)
    `)
    .order('created_at', { ascending: false });

  // Apply filters
  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }
  if (categoryFilter && categoryFilter !== 'all') {
    query = query.eq('category', categoryFilter);
  }

  // For advisors, filter to their own tickets or tickets assigned to them or related to them
  if (!context.isAdmin && context.role === 'advisor') {
    const filters = [`created_by_profile_id.eq.${context.profileId}`, `assigned_to_profile_id.eq.${context.profileId}`];
    if (context.advisorId) {
      filters.push(`advisor_id.eq.${context.advisorId}`);
    }
    query = query.or(filters.join(','));
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching tickets:', error);
    return [];
  }

  return (data ?? []) as TicketWithRelations[];
}

export default async function TicketsPage({ searchParams }: PageProps) {
  const tickets = await getTickets(searchParams.status, searchParams.category);
  
  const openCount = tickets.filter(t => t.status === 'open').length;
  const inProgressCount = tickets.filter(t => t.status === 'in_progress').length;
  const urgentCount = tickets.filter(t => t.priority === 'urgent').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-500">Manage support tickets and service requests</p>
        </div>
        <CreateTicketDialog />
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-slate-900">{tickets.length}</div>
            <p className="text-sm text-slate-500">Total Tickets</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-slate-900">{openCount}</div>
            <p className="text-sm text-slate-500">Open</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-slate-900">{inProgressCount}</div>
            <p className="text-sm text-slate-500">In Progress</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-slate-900">{urgentCount}</div>
            <p className="text-sm text-slate-500">Urgent</p>
          </CardContent>
        </Card>
      </div>

      {/* Tickets Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Ticket className="w-5 h-5 text-slate-400" />
            All Tickets
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
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="waiting">Waiting</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
                <Select name="category" defaultValue={searchParams.category || 'all'}>
                  <SelectTrigger className="w-32 h-9">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="need">Need</SelectItem>
                    <SelectItem value="enrollment">Enrollment</SelectItem>
                    <SelectItem value="billing">Billing</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </form>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Search tickets..." 
                className="pl-9 h-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {tickets.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <Ticket className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="font-medium">No tickets found</p>
              <p className="text-sm text-slate-400 mt-1">Click &quot;Create Ticket&quot; to create your first ticket</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => (
                  <TableRow key={ticket.id} className="cursor-pointer hover:bg-slate-50">
                    <TableCell>
                      <Link 
                        href={`/tickets/${ticket.id}`}
                        className="block"
                      >
                        <div className="font-medium text-blue-600 hover:text-blue-800 hover:underline max-w-[250px] truncate">
                          {ticket.subject}
                        </div>
                        <div className="text-xs text-slate-400 truncate max-w-[250px]">
                          {ticket.description}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <CategoryBadge category={ticket.category} />
                    </TableCell>
                    <TableCell>
                      <TicketStatusBadge status={ticket.status} />
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={ticket.priority} />
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {ticket.members ? (
                        <Link 
                          href={`/members/${ticket.members.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {ticket.members.first_name} {ticket.members.last_name}
                        </Link>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {ticket.assigned_to?.full_name ?? (
                        <span className="text-slate-400">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-400 text-sm">
                      {format(new Date(ticket.created_at), 'MMM d, yyyy')}
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
