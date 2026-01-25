import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, User, Calendar, Tag, AlertCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { TicketConversation } from '../../components/tickets/TicketConversation';
import { MessageComposer } from '../../components/tickets/MessageComposer';
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
  last_message_at: string | null;
  submitter_name: string | null;
  submitter_email: string | null;
}

export default function MemberTicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email');
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id && email) {
      fetchTicket();
    } else {
      setError('Invalid ticket access');
      setLoading(false);
    }
  }, [id, email]);

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
          last_message_at,
          submitter_name,
          submitter_email
        `)
        .eq('id', id)
        .eq('submitter_email', email)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setError('Ticket not found or you do not have access');
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-blue-50 to-primary-100 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-800 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-800 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-blue-50 to-primary-100 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-800 flex items-center justify-center">
        <div className="text-center py-12">
          <AlertCircle className="mx-auto text-accent-500 mb-4" size={48} />
          <p className="text-neutral-600 dark:text-neutral-400">{error || 'Ticket not found'}</p>
          <button
            onClick={() => navigate('/support/member/tickets')}
            className="mt-4 px-4 py-2 bg-primary-800 text-white rounded-xl hover:bg-primary-900"
          >
            Back to Tickets
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-blue-50 to-primary-100 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-800">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate(`/support/member/tickets?email=${encodeURIComponent(email || '')}`)}
          className="inline-flex items-center gap-2 mb-6 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
        >
          <ArrowLeft size={20} />
          Back to My Tickets
        </button>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h1 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
                    {ticket.subject}
                  </h1>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(ticket.status)}`}>
                      {ticket.status}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPriorityColor(ticket.priority)}`}>
                      {ticket.priority} priority
                    </span>
                    {ticket.category && (
                      <span className="px-3 py-1 bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-full text-sm">
                        {ticket.category}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {ticket.description && (
                <div className="mb-6 p-4 bg-neutral-50 dark:bg-neutral-900 rounded-lg">
                  <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                    Original Request
                  </h3>
                  <p className="text-neutral-900 dark:text-white whitespace-pre-wrap">
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

              <div className="border-t border-neutral-200 dark:border-neutral-700 pt-6">
                <TicketConversation ticketId={ticket.id} onNewMessage={fetchTicket} />
              </div>
            </div>

            <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
                Reply to Support Team
              </h3>
              <MessageComposer
                ticketId={ticket.id}
                onMessageSent={fetchTicket}
                allowInternal={false}
              />
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
                Ticket Details
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                    <User size={16} />
                    Your Name
                  </label>
                  <p className="text-neutral-900 dark:text-white">
                    {ticket.submitter_name || 'Not provided'}
                  </p>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    {ticket.submitter_email}
                  </p>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                    <Tag size={16} />
                    Category
                  </label>
                  <p className="text-neutral-900 dark:text-white">
                    {ticket.category || 'General'}
                  </p>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                    <Calendar size={16} />
                    Created
                  </label>
                  <p className="text-neutral-900 dark:text-white">
                    {format(new Date(ticket.created_at), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>

                {ticket.last_message_at && (
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                      <Clock size={16} />
                      Last Activity
                    </label>
                    <p className="text-neutral-900 dark:text-white">
                      {format(new Date(ticket.last_message_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-primary-50 dark:bg-primary-950/20 border border-primary-200 dark:border-primary-800 rounded-lg p-4">
              <h4 className="font-semibold text-primary-900 dark:text-primary-100 mb-2">
                Need Help?
              </h4>
              <p className="text-sm text-primary-900 dark:text-primary-200 mb-3">
                Our support team will respond to your ticket as soon as possible. You will receive email notifications when there are updates.
              </p>
              <p className="text-xs text-primary-900 dark:text-primary-300">
                Ticket ID: {ticket.id.slice(0, 8)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
