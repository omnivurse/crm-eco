import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, CheckSquare, Square, Download, Paperclip } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';
import { TicketActionsMenu } from '../../components/tickets/TicketActionsMenu';
import { TicketQuickView } from '../../components/tickets/TicketQuickView';
import { ManageWatchersModal } from '../../components/tickets/ManageWatchersModal';

interface Ticket {
  id: string;
  subject: string;
  description?: string;
  status: string;
  priority: string;
  category?: string;
  created_at: string;
  requester_id?: string;
  assignee_id?: string;
  attachment_count?: number;
  requester: {
    full_name: string;
    email: string;
  } | null;
  assignee: {
    id?: string;
    full_name: string;
    email: string;
  } | null;
}

export function EnhancedTicketsList() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [quickViewTicketId, setQuickViewTicketId] = useState<string | null>(null);
  const [watchersTicketId, setWatchersTicketId] = useState<string | null>(null);
  const [staffMembers, setStaffMembers] = useState<any[]>([]);

  const isStaff = profile?.role && ['staff', 'agent', 'admin', 'super_admin'].includes(profile.role);

  useEffect(() => {
    fetchTickets();
    if (isStaff) {
      fetchStaffMembers();
    }
  }, [statusFilter, priorityFilter]);

  useEffect(() => {
    setShowBulkActions(selectedTickets.size > 0);
  }, [selectedTickets]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('tickets')
        .select(`
          id,
          subject,
          description,
          status,
          priority,
          category,
          created_at,
          requester_id,
          assignee_id,
          requester:profiles!tickets_requester_id_fkey(full_name, email),
          assignee:profiles!tickets_assignee_id_fkey(id, full_name, email),
          ticket_files(count)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (priorityFilter !== 'all') {
        query = query.eq('priority', priorityFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      const formattedData = (data || []).map(ticket => ({
        ...ticket,
        requester: Array.isArray(ticket.requester) ? ticket.requester[0] : ticket.requester,
        assignee: Array.isArray(ticket.assignee) ? ticket.assignee[0] : ticket.assignee,
        attachment_count: Array.isArray(ticket.ticket_files) ? ticket.ticket_files.length : 0
      }));
      setTickets(formattedData as any);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStaffMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('role', ['staff', 'agent', 'admin', 'super_admin'])
        .order('full_name');

      if (error) throw error;
      setStaffMembers(data || []);
    } catch (err) {
      console.error('Error fetching staff members:', err);
    }
  };

  const toggleSelectTicket = (ticketId: string) => {
    const newSelected = new Set(selectedTickets);
    if (newSelected.has(ticketId)) {
      newSelected.delete(ticketId);
    } else {
      newSelected.add(ticketId);
    }
    setSelectedTickets(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedTickets.size === filteredTickets.length) {
      setSelectedTickets(new Set());
    } else {
      setSelectedTickets(new Set(filteredTickets.map(t => t.id)));
    }
  };

  const handleBulkAssign = async (assigneeId: string) => {
    try {
      const promises = Array.from(selectedTickets).map(ticketId =>
        supabase
          .from('tickets')
          .update({ assignee_id: assigneeId, updated_at: new Date().toISOString() })
          .eq('id', ticketId)
      );

      await Promise.all(promises);
      setSelectedTickets(new Set());
      await fetchTickets();
    } catch (err: any) {
      console.error('Error bulk assigning:', err);
      alert('Failed to assign tickets: ' + (err.message || 'Unknown error'));
    }
  };

  const handleBulkStatusChange = async (status: string) => {
    try {
      const promises = Array.from(selectedTickets).map(ticketId =>
        supabase
          .from('tickets')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', ticketId)
      );

      await Promise.all(promises);
      setSelectedTickets(new Set());
      await fetchTickets();
    } catch (err: any) {
      console.error('Error bulk updating status:', err);
      alert('Failed to update tickets: ' + (err.message || 'Unknown error'));
    }
  };

  const handleExportSelected = () => {
    const selectedData = tickets.filter(t => selectedTickets.has(t.id));
    const csv = [
      ['ID', 'Subject', 'Status', 'Priority', 'Requester', 'Assignee', 'Created'],
      ...selectedData.map(t => [
        t.id.substring(0, 8),
        t.subject,
        t.status,
        t.priority,
        t.requester?.full_name || t.requester?.email || 'Unknown',
        t.assignee?.full_name || 'Unassigned',
        new Date(t.created_at).toLocaleDateString()
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tickets-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const filteredTickets = tickets.filter((ticket) =>
    ticket.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const priorityColors: Record<string, string> = {
    urgent: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    low: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  };

  const statusColors: Record<string, string> = {
    new: 'bg-primary-100 text-primary-900 dark:bg-primary-950 dark:text-primary-200',
    open: 'bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200',
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    resolved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    closed: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200',
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center px-6">
        <div className="space-y-1">
          <h1 className="championship-title text-4xl" data-text="Tickets">
            Tickets
          </h1>
          <p className="text-xl text-neutral-600 dark:text-neutral-400">
            Manage your support requests
          </p>
        </div>
        <Link
          to="/tickets/new"
          className="group inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-primary-700 to-primary-800 hover:from-primary-800 hover:to-primary-900 text-white font-semibold rounded-xl shadow-lg shadow-primary-800/30 hover:shadow-xl hover:shadow-primary-900/40 transition-all duration-300 hover:-translate-y-0.5"
        >
          <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
          New Ticket
        </Link>
      </div>

      <div className="glass-card p-6 mx-6 my-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative group">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neutral-400 group-focus-within:text-primary-600 transition-colors" size={20} />
            <input
              type="text"
              placeholder="Search tickets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 border-2 border-neutral-200 dark:border-neutral-600 rounded-xl bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:border-primary-600 focus:ring-4 focus:ring-primary-500/10 transition-all"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 border-2 border-neutral-200 dark:border-neutral-600 rounded-xl bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:border-primary-600 focus:ring-4 focus:ring-primary-500/10 transition-all cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="new">New</option>
            <option value="open">Open</option>
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-4 py-3 border-2 border-neutral-200 dark:border-neutral-600 rounded-xl bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:border-primary-600 focus:ring-4 focus:ring-primary-500/10 transition-all cursor-pointer"
          >
            <option value="all">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>

      <div className="glass-card overflow-hidden mx-6 mb-6">
        {loading ? (
          <div className="p-16 text-center">
            <div className="inline-block w-12 h-12 border-4 border-primary-800 border-t-transparent rounded-full animate-spin mb-6"></div>
            <p className="text-lg font-medium text-neutral-600 dark:text-neutral-400">Loading tickets...</p>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-700 dark:to-neutral-800 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Filter className="h-10 w-10 text-neutral-400" />
            </div>
            <p className="text-2xl font-semibold text-neutral-900 dark:text-white mb-2">No tickets found</p>
            <p className="text-neutral-600 dark:text-neutral-400">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-neutral-50 to-neutral-100 dark:from-neutral-700/50 dark:to-neutral-800/50 border-b-2 border-neutral-200 dark:border-neutral-600">
                <tr>
                  {isStaff && (
                    <th className="px-4 py-4 text-left">
                      <button
                        onClick={toggleSelectAll}
                        className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded transition-colors"
                      >
                        {selectedTickets.size === filteredTickets.length ? (
                          <CheckSquare size={18} className="text-primary-800 dark:text-primary-500" />
                        ) : (
                          <Square size={18} className="text-neutral-500" />
                        )}
                      </button>
                    </th>
                  )}
                  <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                    Subject
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                    Requester
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                    Assignee
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700/50">
                {filteredTickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    className={`hover:bg-gradient-to-r hover:from-primary-50/50 hover:to-transparent dark:hover:from-primary-900/10 dark:hover:to-transparent transition-all duration-200 ${selectedTickets.has(ticket.id) ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}
                  >
                    {isStaff && (
                      <td className="px-4 py-4">
                        <button
                          onClick={() => toggleSelectTicket(ticket.id)}
                          className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded transition-colors"
                        >
                          {selectedTickets.has(ticket.id) ? (
                            <CheckSquare size={18} className="text-primary-800 dark:text-primary-500" />
                          ) : (
                            <Square size={18} className="text-neutral-500" />
                          )}
                        </button>
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setQuickViewTicketId(ticket.id)}
                          className="text-primary-800 dark:text-primary-500 hover:text-primary-900 dark:hover:text-primary-300 font-semibold transition-colors text-left"
                        >
                          {ticket.subject}
                        </button>
                        {ticket.attachment_count && ticket.attachment_count > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-medium rounded-full">
                            <Paperclip size={12} />
                            {ticket.attachment_count}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-neutral-900 dark:text-white">
                      {ticket.requester?.full_name || ticket.requester?.email || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-neutral-900 dark:text-white">
                      {ticket.assignee?.full_name || ticket.assignee?.email || 'Unassigned'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`modern-badge ${statusColors[ticket.status]}`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`modern-badge ${priorityColors[ticket.priority]}`}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-neutral-600 dark:text-neutral-400">
                      {new Date(ticket.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <TicketActionsMenu
                        ticket={ticket}
                        onViewDetails={() => setQuickViewTicketId(ticket.id)}
                        onEdit={() => navigate(`/tickets/${ticket.id}`)}
                        onAddWatcher={() => setWatchersTicketId(ticket.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showBulkActions && isStaff && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40">
          <div className="glass-card px-6 py-4 shadow-2xl border-2 border-primary-500">
            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold text-neutral-900 dark:text-white">
                {selectedTickets.size} selected
              </span>
              <div className="flex items-center gap-2">
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleBulkAssign(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-sm font-medium"
                >
                  <option value="">Assign to...</option>
                  {staffMembers.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.full_name || staff.email}
                    </option>
                  ))}
                </select>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleBulkStatusChange(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-sm font-medium"
                >
                  <option value="">Change status...</option>
                  <option value="open">Open</option>
                  <option value="pending">Pending</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
                <button
                  onClick={handleExportSelected}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors"
                >
                  <Download size={18} />
                  Export
                </button>
                <button
                  onClick={() => setSelectedTickets(new Set())}
                  className="px-4 py-2 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 rounded-lg font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {quickViewTicketId && (
        <TicketQuickView
          ticketId={quickViewTicketId}
          isOpen={true}
          onClose={() => setQuickViewTicketId(null)}
          onOpenFullView={() => {
            navigate(`/tickets/${quickViewTicketId}`);
            setQuickViewTicketId(null);
          }}
        />
      )}

      {watchersTicketId && (
        <ManageWatchersModal
          ticketId={watchersTicketId}
          isOpen={true}
          onClose={() => setWatchersTicketId(null)}
        />
      )}
    </div>
  );
}
