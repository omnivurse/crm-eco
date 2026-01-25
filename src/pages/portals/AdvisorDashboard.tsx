import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, LogOut, Ticket, Clock, CheckCircle, XCircle, MessageCircle, Bell } from 'lucide-react';
import { Logo } from '../../components/ui/Logo';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';

interface TicketData {
  id: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  created_at: string;
  advisor_id: string | null;
  last_message_at: string | null;
  response_count: number;
  unread?: number;
}

export default function AdvisorDashboard() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTickets();
  }, [user]);

  const loadTickets = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          id,
          subject,
          status,
          priority,
          category,
          created_at,
          advisor_id,
          last_message_at,
          response_count
        `)
        .eq('origin', 'advisor')
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      console.error('Error loading tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login/advisor');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'new':
        return <Clock className="text-primary-600" size={18} />;
      case 'open':
        return <Ticket className="text-yellow-500" size={18} />;
      case 'resolved':
        return <CheckCircle className="text-success-500" size={18} />;
      case 'closed':
        return <XCircle className="text-neutral-500" size={18} />;
      default:
        return <Ticket className="text-neutral-500" size={18} />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      default:
        return 'bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-300';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-800">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Logo size="medium" />
            <div>
              <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">
                Advisor Dashboard
              </h1>
              <p className="text-neutral-600 dark:text-neutral-400">
                Manage your support tickets
              </p>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="flex items-center space-x-2 px-4 py-2 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>

        <div className="mb-6">
          <button
            onClick={() => navigate('/advisor/ticket/new')}
            className="flex items-center space-x-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-xl transition-colors"
          >
            <Plus size={20} />
            <span>Submit New Ticket</span>
          </button>
        </div>

        <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl">
          <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
              Your Tickets
            </h2>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-neutral-600 dark:text-neutral-400">Loading tickets...</p>
            </div>
          ) : tickets.length === 0 ? (
            <div className="p-12 text-center">
              <Ticket className="mx-auto text-neutral-400 mb-4" size={48} />
              <p className="text-neutral-600 dark:text-neutral-400">No tickets found</p>
              <p className="text-sm text-neutral-500 dark:text-neutral-500 mt-2">
                Submit your first ticket to get started
              </p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="p-6 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/advisor/ticket/${ticket.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      <div className="mt-1">{getStatusIcon(ticket.status)}</div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-medium text-neutral-900 dark:text-white mb-1">
                          {ticket.subject}
                        </h3>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-600 dark:text-neutral-400">
                          <span className="flex items-center">
                            <Clock size={14} className="mr-1" />
                            {formatDate(ticket.last_message_at || ticket.created_at)}
                          </span>
                          {ticket.response_count > 0 && (
                            <span className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded text-xs">
                              <MessageCircle size={12} />
                              {ticket.response_count} {ticket.response_count === 1 ? 'reply' : 'replies'}
                            </span>
                          )}
                          {ticket.category && (
                            <span className="px-2 py-1 bg-neutral-100 dark:bg-neutral-700 rounded text-xs">
                              {ticket.category}
                            </span>
                          )}
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(
                              ticket.priority
                            )}`}
                          >
                            {ticket.priority}
                          </span>
                          <span className="px-2 py-1 bg-primary-100 dark:bg-primary-950/30 text-primary-900 dark:text-primary-300 rounded text-xs font-medium capitalize">
                            {ticket.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
