import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge, Button } from '@crm-eco/ui';
import { Plus, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import type { Database } from '@crm-eco/lib/types';

type Lead = Database['public']['Tables']['leads']['Row'];

interface LeadWithAdvisor extends Lead {
  advisors?: { first_name: string; last_name: string } | null;
}

async function getLeads(): Promise<LeadWithAdvisor[]> {
  const supabase = await createServerSupabaseClient();
  
  const { data, error } = await supabase
    .from('leads')
    .select('*, advisors(first_name, last_name)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching leads:', error);
    return [];
  }

  return (data ?? []) as LeadWithAdvisor[];
}

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case 'new':
      return 'default';
    case 'contacted':
      return 'secondary';
    case 'qualified':
      return 'warning';
    case 'converted':
      return 'success';
    case 'lost':
      return 'destructive';
    default:
      return 'outline';
  }
}

export default async function LeadsPage() {
  const leads = await getLeads();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Leads</h1>
          <p className="text-slate-600">Track and convert potential members</p>
        </div>
        <Button disabled>
          <Plus className="h-4 w-4 mr-2" />
          Add Lead
        </Button>
      </div>

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
                Leads will appear here when captured from enrollment forms or manually added.
              </p>
              <p className="text-xs text-slate-400 mt-4">
                Lead management features coming in Phase 2
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
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
                    <TableCell>{lead.source ?? '-'}</TableCell>
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
