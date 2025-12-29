import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge, Button } from '@crm-eco/ui';
import { Plus, HeartPulse } from 'lucide-react';
import { format } from 'date-fns';
import type { Database } from '@crm-eco/lib/types';

type Need = Database['public']['Tables']['needs']['Row'];

interface NeedWithMember extends Need {
  members?: { first_name: string; last_name: string } | null;
}

async function getNeeds(): Promise<NeedWithMember[]> {
  const supabase = await createServerSupabaseClient();
  
  const { data, error } = await supabase
    .from('needs')
    .select('*, members(first_name, last_name)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching needs:', error);
    return [];
  }

  return (data ?? []) as NeedWithMember[];
}

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case 'open':
      return 'default';
    case 'in_review':
      return 'warning';
    case 'paid':
      return 'success';
    case 'closed':
      return 'secondary';
    default:
      return 'outline';
  }
}

function getUrgencyBadge(urgency: string) {
  switch (urgency) {
    case 'red':
      return <Badge variant="destructive">Urgent</Badge>;
    case 'orange':
      return <Badge variant="warning">Medium</Badge>;
    case 'green':
      return <Badge variant="success">Normal</Badge>;
    default:
      return <Badge variant="outline">Unknown</Badge>;
  }
}

export default async function NeedsPage() {
  const needs = await getNeeds();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Needs</h1>
          <p className="text-slate-600">Manage member healthcare needs and reimbursements</p>
        </div>
        <Button disabled>
          <Plus className="h-4 w-4 mr-2" />
          Create Need
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Needs</CardTitle>
        </CardHeader>
        <CardContent>
          {needs.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <HeartPulse className="w-8 h-8 text-purple-500" />
              </div>
              <p className="text-slate-600 mb-2">No needs recorded yet</p>
              <p className="text-sm text-slate-500">
                Healthcare needs will be tracked here for reimbursement processing.
              </p>
              <p className="text-xs text-slate-400 mt-4">
                Full needs management with AI-powered pricing coming in Phase 2
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Need Type</TableHead>
                  <TableHead>Total Amount</TableHead>
                  <TableHead>Eligible</TableHead>
                  <TableHead>Reimbursed</TableHead>
                  <TableHead>Urgency</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {needs.map((need) => (
                  <TableRow key={need.id}>
                    <TableCell className="font-medium">
                      {need.members
                        ? `${need.members.first_name} ${need.members.last_name}`
                        : '-'}
                    </TableCell>
                    <TableCell className="capitalize">{need.need_type}</TableCell>
                    <TableCell>${Number(need.total_amount).toLocaleString()}</TableCell>
                    <TableCell>${Number(need.eligible_amount).toLocaleString()}</TableCell>
                    <TableCell>${Number(need.reimbursed_amount).toLocaleString()}</TableCell>
                    <TableCell>{getUrgencyBadge(need.urgency_light)}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(need.status)}>
                        {need.status.replace('_', ' ')}
                      </Badge>
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
    </div>
  );
}
