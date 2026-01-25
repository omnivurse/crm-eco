import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Calendar, Tag, AlertCircle, Clock, Star, UserPlus, CheckCircle, MessageSquare, Mail, Eye, Timer } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';
import { TicketConversation } from '../../components/tickets/TicketConversation';
import { MessageComposer } from '../../components/tickets/MessageComposer';
import { SendEmailModal } from '../../components/tickets/SendEmailModal';
import { ManageWatchersModal } from '../../components/tickets/ManageWatchersModal';
import { ManageTagsModal } from '../../components/tickets/ManageTagsModal';
import { TimeTrackingModal } from '../../components/tickets/TimeTrackingModal';
import { TicketAttachmentsViewer } from '../../components/tickets/TicketAttachmentsViewer';

interface Ticket {
  id: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  origin: string;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
  satisfaction_rating: number | null;
  submitter_name: string | null;
  submitter_email: string | null;
  requester: {
    full_name: string;
    email: string;
  } | null;
  assignee: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  assignee_id: string | null;
}

interface StaffMember {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

export function EnhancedTicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [updating, setUpdating] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showWatchersModal, setShowWatchersModal] = useState(false);
  const [showTagsModal, setShowTagsModal] = useState(false);
  const [showTimeTrackingModal, setShowTimeTrackingModal] = useState(false);
  const [watchers, setWatchers] = useState<any[]>([]);
  const [ticketTags, setTicketTags] = useState<any[]>([]);
  const [totalHours, setTotalHours] = useState(0);

  const isStaff = profile?.role && ['staff', 'agent', 'admin', 'super_admin', 'concierge'].includes(profile.role);

  useEffect(() => {
    if (id) {
      fetchTicket();
      markTicketAsRead();
      if (isStaff) {
        fetchStaffMembers();
      }
    }
  }, [id, isStaff]);

  const fetchTicket = async () => {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          id,
          subject,
          description,
          status,
          priority,
          category,
          origin,
          created_at,
          updated_at,
          last_message_at,
          satisfaction_rating,
          submitter_name,
          submitter_email,
          requester:profiles!tickets_requester_id_fkey(full_name, email),
          assignee:profiles!tickets_assignee_id_fkey(full_name, email)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setError('Ticket not found');
        return;
      }

      setTicket(data as any);
    } catch (err: any) {
      console.error('Error fetching ticket:', err);
      setError(err.message || 'Failed to load ticket');
    } finally {
      setLoading(false);
    }
  };

  const markTicketAsRead = async () => {
    if (!profile?.id || !id) return;

    try {
      await supabase
        .from('ticket_read_status')
        .upsert({
          ticket_id: id,
          user_id: profile.id,
          last_read_at: new Date().toISOString(),
          unread_count: 0,
        }, {
          onConflict: 'ticket_id,user_id'
        });
    } catch (error) {
      console.error('Error marking ticket as read:', error);
    }
  };

  const fetchStaffMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .in('role', ['staff', 'agent', 'admin', 'super_admin'])
        .order('full_name');

      if (error) throw error;
      setStaffMembers(data || []);
    } catch (err) {
      console.error('Error fetching staff members:', err);
    }
  };

  const handleAssignTicket = async (assigneeId: string | null) => {
    if (!id) return;

    setUpdating(true);
    try {
      const { error } = await supabase
        .from('tickets')
        .update({
          assignee_id: assigneeId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      await fetchTicket();
    } catch (err: any) {
      console.error('Error assigning ticket:', err);
      alert('Failed to assign ticket: ' + (err.message || 'Unknown error'));
    } finally {
      setUpdating(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!id || !ticket) return;

    setUpdating(true);
    try {
      const { error } = await supabase
        .from('tickets')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      await fetchTicket();
    } catch (err: any) {
      console.error('Error updating status:', err);
      alert('Failed to update status: ' + (err.message || 'Unknown error'));
    } finally {
      setUpdating(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      urgent: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      low: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    };
    return colors[priority] || 'bg-neutral-100 text-neutral-800';
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: 'bg-primary-100 text-primary-900 dark:bg-primary-950 dark:text-primary-200',
      open: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      resolved: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200',
      closed: 'bg-neutral-200 text-neutral-800 dark:bg-neutral-600 dark:text-neutral-200',
    };
    return colors[status] || 'bg-neutral-100 text-neutral-800';
  };

  const getOriginLabel = (origin: string) => {
    const labels: Record<string, string> = {
      member: 'Member Portal',
      advisor: 'Advisor Portal',
      concierge: 'Concierge Portal',
      staff: 'Staff Portal',
      email: 'Email',
      chat: 'Live Chat',
    };
    return labels[origin] || origin;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary-800 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto text-accent-500 mb-4" size={48} />
        <p className="text-neutral-600 dark:text-neutral-400">{error || 'Ticket not found'}</p>
        <button
          onClick={() => navigate('/tickets')}
          className="mt-4 px-4 py-2 bg-primary-800 text-white rounded-xl hover:bg-primary-900"
        >
          Back to Tickets
        </button>
      </div>
    );
  }

  const requesterDisplay = ticket.requester
    ? ticket.requester.full_name || ticket.requester.email
    : ticket.submitter_name || ticket.submitter_email || 'Unknown';

  const requesterEmail = ticket?.requester?.email || ticket?.submitter_email;
  const hasRequesterEmail = requesterEmail && requesterEmail.trim() !== '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/tickets')}
          className="group inline-flex items-center gap-2 px-4 py-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-all duration-200"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform duration-200" />
          <span className="font-medium">Back to Tickets</span>
        </button>

        {isStaff && hasRequesterEmail && ticket && (
          <button
            onClick={() => setShowEmailModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-800 hover:bg-primary-900 text-white rounded-xl transition-colors font-medium"
          >
            <Mail size={18} />
            Email Requester
          </button>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card p-8">
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1">
                <h1 className="championship-title text-3xl mb-4 leading-tight" data-text={ticket.subject}>
                  {ticket.subject}
                </h1>
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className={`modern-badge ${getStatusColor(ticket.status)}`}>
                    {ticket.status}
                  </span>
                  <span className={`modern-badge ${getPriorityColor(ticket.priority)}`}>
                    {ticket.priority} priority
                  </span>
                  {ticket.category && (
                    <span className="modern-badge bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300">
                      {ticket.category}
                    </span>
                  )}
                </div>
              </div>
              {ticket.satisfaction_rating && (
                <div className="flex items-center gap-1 text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-xl">
                  {Array.from({ length: ticket.satisfaction_rating }).map((_, i) => (
                    <Star key={i} size={18} fill="currentColor" />
                  ))}
                </div>
              )}
            </div>

            {ticket.description && (
              <div className="mb-6 p-5 bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-800 rounded-xl border border-neutral-200/50 dark:border-neutral-700/50">
                <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3 flex items-center gap-2">
                  <MessageSquare size={16} />
                  Original Request
                </h3>
                <p className="text-neutral-900 dark:text-white whitespace-pre-wrap leading-relaxed">
                  {ticket.description}
                </p>
              </div>
            )}

            <div className="mb-6">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                Attachments
              </h3>
              <TicketAttachmentsViewer ticketId={ticket.id} />
            </div>

            <div className="border-t-2 border-neutral-200 dark:border-neutral-700 pt-6">
              <TicketConversation ticketId={ticket.id} onNewMessage={fetchTicket} />
            </div>
          </div>

          <div className="glass-card p-6">
            <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-5 flex items-center gap-2">
              <MessageSquare size={22} />
              Reply
            </h3>
            <MessageComposer
              ticketId={ticket.id}
              onMessageSent={fetchTicket}
              allowInternal={isStaff}
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card p-6">
            <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-6">
              Ticket Details
            </h3>

            <div className="space-y-5">
              <div className="p-4 bg-gradient-to-br from-primary-50 to-primary-100/50 dark:from-primary-900/20 dark:to-primary-900/10 rounded-xl border border-primary-200/50 dark:border-primary-900/30">
                <label className="flex items-center gap-2 text-sm font-semibold text-primary-900 dark:text-primary-300 mb-2">
                  <User size={16} />
                  Requester
                </label>
                <p className="text-neutral-900 dark:text-white font-medium">
                  {requesterDisplay}
                </p>
                {ticket.submitter_email && (
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                    {ticket.submitter_email}
                  </p>
                )}
              </div>

              {isStaff && (
                <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-900/10 rounded-xl border border-purple-200/50 dark:border-purple-700/30">
                  <label className="flex items-center gap-2 text-sm font-semibold text-purple-700 dark:text-purple-300 mb-3">
                    <CheckCircle size={16} />
                    Status
                  </label>
                  <select
                    value={ticket.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    disabled={updating}
                    className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-neutral-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="new">New</option>
                    <option value="open">Open</option>
                    <option value="pending">Pending</option>
                    <option value="on_hold">On Hold</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              )}

              {isStaff && (
                <div className="p-4 bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-900/10 rounded-xl border border-green-200/50 dark:border-green-700/30">
                  <label className="flex items-center gap-2 text-sm font-semibold text-success-700 dark:text-green-300 mb-3">
                    <UserPlus size={16} />
                    Assign To
                  </label>
                  <select
                    value={ticket.assignee?.id || ''}
                    onChange={(e) => handleAssignTicket(e.target.value || null)}
                    disabled={updating}
                    className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent text-neutral-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Unassigned</option>
                    {staffMembers.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.full_name || staff.email}
                      </option>
                    ))}
                  </select>
                  {ticket.assignee && (
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2">
                      Currently: {ticket.assignee.full_name || ticket.assignee.email}
                    </p>
                  )}
                </div>
              )}

              {!isStaff && ticket.assignee && (
                <div className="p-4 bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-900/10 rounded-xl border border-green-200/50 dark:border-green-700/30">
                  <label className="flex items-center gap-2 text-sm font-semibold text-success-700 dark:text-green-300 mb-2">
                    <User size={16} />
                    Assigned To
                  </label>
                  <p className="text-neutral-900 dark:text-white font-medium">
                    {ticket.assignee.full_name || ticket.assignee.email}
                  </p>
                </div>
              )}

              <div className="p-4 bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-900/10 rounded-xl border border-amber-200/50 dark:border-amber-700/30">
                <label className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300 mb-2">
                  <Tag size={16} />
                  Origin
                </label>
                <p className="text-neutral-900 dark:text-white font-medium">
                  {getOriginLabel(ticket.origin)}
                </p>
              </div>

              <div className="p-4 bg-gradient-to-br from-neutral-50 to-neutral-100/50 dark:from-neutral-800 dark:to-neutral-700/50 rounded-xl border border-neutral-200/50 dark:border-neutral-600/30">
                <label className="flex items-center gap-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                  <Calendar size={16} />
                  Created
                </label>
                <p className="text-neutral-900 dark:text-white font-medium">
                  {format(new Date(ticket.created_at), 'MMM d, yyyy h:mm a')}
                </p>
              </div>

              {ticket.last_message_at && (
                <div className="p-4 bg-gradient-to-br from-neutral-50 to-neutral-100/50 dark:from-neutral-800 dark:to-neutral-700/50 rounded-xl border border-neutral-200/50 dark:border-neutral-600/30">
                  <label className="flex items-center gap-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                    <Clock size={16} />
                    Last Activity
                  </label>
                  <p className="text-neutral-900 dark:text-white font-medium">
                    {format(new Date(ticket.last_message_at), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {ticket && (
        <SendEmailModal
          ticket={ticket}
          isOpen={showEmailModal}
          onClose={() => setShowEmailModal(false)}
          onEmailSent={() => {
            console.log('Email sent successfully');
          }}
        />
      )}
    </div>
  );
}
