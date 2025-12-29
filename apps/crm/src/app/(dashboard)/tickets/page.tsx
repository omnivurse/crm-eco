import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge } from '@crm-eco/ui';
import { CreateTicketDialog } from '@/components/tickets/create-ticket-dialog';
import { format } from 'date-fns';
import type { Database } from '@crm-eco/lib/types';

type Ticket = Database['public']['Tables']['tickets']['Row'];

interface TicketWithRelations extends Ticket {
  created_by?: { full_name: string } | null;
  assigned_to?: { full_name: string } | null;
  members?: { first_name: string; last_name: string } | null;
}

async function getTickets(): Promise<TicketWithRelations[]> {
  const supabase = await createServerSupabaseClient();
  
  const { data, error } = await supabase
    .from('tickets')
    .select(`
      *,
      created_by:profiles!tickets_created_by_profile_id_fkey(full_name),
      assigned_to:profiles!tickets_assigned_to_profile_id_fkey(full_name),
      members(first_name, last_name)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching tickets:', error);
    return [];
  }

  return (data ?? []) as TicketWithRelations[];
}

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case 'open':
      return 'default';
    case 'in_progress':
      return 'warning';
    case 'waiting':
      return 'secondary';
    case 'resolved':
      return 'success';
    case 'closed':
      return 'outline';
    default:
      return 'outline';
  }
}

function getPriorityBadgeVariant(priority: string) {
  switch (priority) {
    case 'urgent':
      return 'destructive';
    case 'high':
      return 'warning';
    case 'normal':
      return 'secondary';
    case 'low':
      return 'outline';
    default:
      return 'outline';
  }
}

export default async function TicketsPage() {
  const tickets = await getTickets();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tickets</h1>
          <p className="text-slate-600">Manage support tickets and requests</p>
        </div>
        <CreateTicketDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Tickets</CardTitle>
        </CardHeader>
        <CardContent>
          {tickets.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p className="mb-2">No tickets found</p>
              <p className="text-sm">Click "Create Ticket" to create your first ticket</p>
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
                  <TableRow key={ticket.id}>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {ticket.subject}
                    </TableCell>
                    <TableCell className="capitalize">{ticket.category}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(ticket.status)}>
                        {ticket.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getPriorityBadgeVariant(ticket.priority)}>
                        {ticket.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {ticket.members
                        ? `${ticket.members.first_name} ${ticket.members.last_name}`
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {ticket.assigned_to?.full_name ?? 'Unassigned'}
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
    </div>
  );
}
