import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ticket, Plus, Clock, CheckCircle, MessageCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface TicketData {
  id: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  created_at: string;
  last_message_at: string | null;
  response_count: number;
  submitter_email: string;
}

export default function MemberTicketList() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setSearched(true);

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
          last_message_at,
          response_count,
          submitter_email
        `)
        .eq('origin', 'member')
        .eq('submitter_email', email.trim().toLowerCase())
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'new':
      case 'open':
        return <Clock className="text-primary-600" size={18} />;
      case 'resolved':
      case 'closed':
        return <CheckCircle className="text-success-500" size={18} />;
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
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-blue-50 to-primary-100 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-800">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate('/support/member')}
          className="inline-flex items-center gap-2 mb-6 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
        >
          <ArrowLeft size={20} />
          Back to Submit Ticket
        </button>

        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 dark:bg-primary-950/30 rounded-full mb-4">
            <Ticket className="text-primary-800 dark:text-primary-500" size={32} />
          </div>
          <h1 className="text-4xl font-bold text-neutral-900 dark:text-white mb-3">
            Track Your Tickets
          </h1>
          <p className="text-lg text-neutral-600 dark:text-neutral-300">
            Enter your email to view your support tickets
          </p>
        </div>

        <div className="max-w-2xl mx-auto mb-8">
          <form onSubmit={handleSearch} className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="your@email.com"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-6 bg-primary-800 hover:bg-primary-900 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
              >
                {loading ? 'Searching...' : 'View My Tickets'}
              </button>
            </div>
          </form>
        </div>

        {searched && (
          <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl">
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
                Your Tickets
              </h2>
              <button
                onClick={() => navigate('/support/member')}
                className="flex items-center gap-2 px-4 py-2 bg-primary-800 hover:bg-primary-900 text-white rounded-xl transition-colors"
              >
                <Plus size={18} />
                New Ticket
              </button>
            </div>

            {loading ? (
              <div className="p-12 text-center">
                <div className="inline-block w-8 h-8 border-4 border-primary-800 border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-neutral-600 dark:text-neutral-400">Loading tickets...</p>
              </div>
            ) : tickets.length === 0 ? (
              <div className="p-12 text-center">
                <Ticket className="mx-auto text-neutral-400 mb-4" size={48} />
                <p className="text-neutral-600 dark:text-neutral-400">No tickets found for this email</p>
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
                    onClick={() => navigate(`/support/member/ticket/${ticket.id}?email=${encodeURIComponent(email)}`)}
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
        )}
      </div>
    </div>
  );
}
