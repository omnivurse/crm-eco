import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { format, formatDistanceToNow } from 'date-fns';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  Badge,
  Separator,
} from '@crm-eco/ui';
import { 
  ArrowLeft,
  User,
  Calendar,
  Clock,
  MessageSquare,
  Lock,
  Users,
  UserCheck,
  Activity,
} from 'lucide-react';
import { getRoleQueryContext } from '@/lib/auth';
import { TicketStatusBadge } from '@/components/shared/status-badge';
import { PriorityBadge } from '@/components/shared/priority-badge';
import { CategoryBadge } from '@/components/shared/category-badge';
import { AddCommentForm } from '@/components/tickets/add-comment-form';
import { ActivityTable } from '@/components/shared/activity-table';
import type { Database } from '@crm-eco/lib/types';

type TicketRow = Database['public']['Tables']['tickets']['Row'];
type TicketComment = Database['public']['Tables']['ticket_comments']['Row'];

interface TicketWithRelations extends TicketRow {
  created_by?: { full_name: string } | null;
  assigned_to?: { full_name: string } | null;
  members?: { id: string; first_name: string; last_name: string } | null;
  advisors?: { id: string; first_name: string; last_name: string } | null;
}

interface CommentWithProfile extends TicketComment {
  profiles?: { full_name: string } | null;
}

interface PageProps {
  params: { id: string };
}

async function getTicket(id: string): Promise<TicketWithRelations | null> {
  const supabase = await createServerSupabaseClient();
  const context = await getRoleQueryContext();
  
  if (!context) return null;

  const { data, error } = await supabase
    .from('tickets')
    .select(`
      *,
      created_by:profiles!tickets_created_by_profile_id_fkey(full_name),
      assigned_to:profiles!tickets_assigned_to_profile_id_fkey(full_name),
      members(id, first_name, last_name),
      advisors(id, first_name, last_name)
    `)
    .eq('id', id)
    .single();
  
  if (error || !data) return null;

  // Role check for advisors
  if (!context.isAdmin && context.role === 'advisor') {
    const ticket = data as TicketWithRelations;
    const canAccess = 
      ticket.created_by_profile_id === context.profileId ||
      ticket.assigned_to_profile_id === context.profileId ||
      ticket.advisor_id === context.advisorId;
    
    if (!canAccess) return null;
  }

  return data as TicketWithRelations;
}

async function getTicketComments(ticketId: string): Promise<CommentWithProfile[]> {
  const supabase = await createServerSupabaseClient();
  
  const { data, error } = await supabase
    .from('ticket_comments')
    .select(`
      *,
      profiles:created_by_profile_id(full_name)
    `)
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });

  if (error) return [];
  return data as CommentWithProfile[];
}

async function getTicketActivities(ticketId: string) {
  const supabase = await createServerSupabaseClient();
  
  const { data, error } = await supabase
    .from('activities')
    .select('*, profiles:created_by_profile_id(full_name)')
    .eq('ticket_id', ticketId)
    .order('occurred_at', { ascending: false })
    .limit(25);

  if (error) return [];
  return data || [];
}

export default async function TicketDetailPage({ params }: PageProps) {
  const ticket = await getTicket(params.id);
  
  if (!ticket) {
    notFound();
  }

  const [comments, activities] = await Promise.all([
    getTicketComments(params.id),
    getTicketActivities(params.id),
  ]);

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link 
        href="/tickets" 
        className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back to Tickets
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Ticket Header */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <CardTitle className="text-xl mb-2">{ticket.subject}</CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <CategoryBadge category={ticket.category} />
                    <TicketStatusBadge status={ticket.status} />
                    <PriorityBadge priority={ticket.priority} />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose prose-slate max-w-none">
                <p className="text-slate-700 whitespace-pre-wrap">{ticket.description}</p>
              </div>
            </CardContent>
          </Card>

          {/* Comments Thread */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-slate-400" />
                Conversation ({comments.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {comments.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <MessageSquare className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="font-medium">No comments yet</p>
                  <p className="text-sm text-slate-400 mt-1">
                    Be the first to add a comment
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {comments.map((comment) => (
                    <div 
                      key={comment.id} 
                      className={`p-4 rounded-lg ${
                        comment.is_internal 
                          ? 'bg-amber-50 border border-amber-200' 
                          : 'bg-slate-50 border border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-slate-600" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">
                              {comment.profiles?.full_name || 'Unknown User'}
                            </p>
                            <p className="text-xs text-slate-500">
                              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                        {comment.is_internal && (
                          <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">
                            <Lock className="w-3 h-3 mr-1" />
                            Internal
                          </Badge>
                        )}
                      </div>
                      <p className="text-slate-700 whitespace-pre-wrap pl-10">
                        {comment.body}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <Separator />

              {/* Add Comment Form */}
              <AddCommentForm ticketId={params.id} />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Ticket Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">Created by</p>
                <p className="font-medium">{ticket.created_by?.full_name || 'Unknown'}</p>
              </div>
              
              <div>
                <p className="text-xs text-slate-500 mb-1">Assigned to</p>
                <p className="font-medium">
                  {ticket.assigned_to?.full_name || (
                    <span className="text-slate-400">Unassigned</span>
                  )}
                </p>
              </div>

              <Separator />

              <div>
                <p className="text-xs text-slate-500 mb-1">Created</p>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <p className="font-medium">
                    {format(new Date(ticket.created_at), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-1">Last Updated</p>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <p className="font-medium">
                    {format(new Date(ticket.updated_at), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              </div>

              {ticket.sla_target_at && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">SLA Target</p>
                  <p className="font-medium">
                    {format(new Date(ticket.sla_target_at), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Linked Entities */}
          {(ticket.members || ticket.advisors) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Linked Entities</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {ticket.members && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Member</p>
                    <Link 
                      href={`/members/${ticket.members.id}`}
                      className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                    >
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <Users className="w-4 h-4 text-blue-600" />
                      </div>
                      <span className="font-medium text-blue-600 hover:underline">
                        {ticket.members.first_name} {ticket.members.last_name}
                      </span>
                    </Link>
                  </div>
                )}

                {ticket.advisors && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Advisor</p>
                    <Link 
                      href={`/advisors/${ticket.advisors.id}`}
                      className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                    >
                      <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                        <UserCheck className="w-4 h-4 text-emerald-600" />
                      </div>
                      <span className="font-medium text-emerald-600 hover:underline">
                        {ticket.advisors.first_name} {ticket.advisors.last_name}
                      </span>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Activity History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="w-5 h-5 text-slate-400" />
                Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityTable 
                activities={activities} 
                emptyMessage="No activity recorded"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

