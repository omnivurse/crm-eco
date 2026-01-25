import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  ArrowLeft,
  Edit,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  Ticket,
  FileText,
  XCircle,
  Loader2,
  Plus,
  Link as LinkIcon,
  X
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

interface Problem {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  root_cause: string;
  workaround_md: string;
  resolution_md: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  closed_at: string | null;
  owner: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  assigned_team: {
    id: string;
    name: string;
  } | null;
}

interface LinkedTicket {
  id: string;
  problem_id: string;
  ticket_id: string;
  relationship_type: string;
  created_at: string;
  ticket: {
    id: string;
    subject: string;
    status: string;
    priority: string;
    created_at: string;
  };
}

export function ProblemDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [linkedTickets, setLinkedTickets] = useState<LinkedTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'tickets' | 'timeline'>('overview');

  useEffect(() => {
    if (id) {
      fetchProblem();
      fetchLinkedTickets();
    }
  }, [id]);

  const fetchProblem = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('problems')
        .select(`
          *,
          owner:profiles!problems_owner_id_fkey(id, full_name, email),
          assigned_team:teams!problems_assigned_team_id_fkey(id, name)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      setProblem(data);
    } catch (error) {
      console.error('Error fetching problem:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLinkedTickets = async () => {
    try {
      const { data, error } = await supabase
        .from('problem_tickets')
        .select(`
          *,
          ticket:tickets(id, subject, status, priority, created_at)
        `)
        .eq('problem_id', id);

      if (error) throw error;
      setLinkedTickets(data || []);
    } catch (error) {
      console.error('Error fetching linked tickets:', error);
    }
  };

  const handleDelete = async () => {
    if (!id) return;

    try {
      const { error } = await supabase.from('problems').delete().eq('id', id);

      if (error) throw error;
      navigate('/problems');
    } catch (error) {
      console.error('Error deleting problem:', error);
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!id) return;

    try {
      const updates: any = { status: newStatus, updated_at: new Date().toISOString() };

      if (newStatus === 'resolved' && !problem?.resolved_at) {
        updates.resolved_at = new Date().toISOString();
      }

      if (newStatus === 'closed' && !problem?.closed_at) {
        updates.closed_at = new Date().toISOString();
      }

      const { error } = await supabase.from('problems').update(updates).eq('id', id);

      if (error) throw error;
      fetchProblem();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const statusConfig: Record<string, { label: string; color: string; icon: any; bgColor: string }> = {
    investigating: {
      label: 'Investigating',
      color: 'text-primary-900 dark:text-primary-300',
      icon: AlertTriangle,
      bgColor: 'bg-primary-100 dark:bg-primary-950/30 border-primary-200 dark:border-primary-800',
    },
    root_cause_found: {
      label: 'Root Cause Found',
      color: 'text-teal-700 dark:text-teal-300',
      icon: FileText,
      bgColor: 'bg-teal-100 dark:bg-teal-900/30 border-teal-200 dark:border-teal-800',
    },
    known_error: {
      label: 'Known Error',
      color: 'text-yellow-700 dark:text-yellow-300',
      icon: AlertTriangle,
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800',
    },
    resolved: {
      label: 'Resolved',
      color: 'text-success-700 dark:text-green-300',
      icon: CheckCircle,
      bgColor: 'bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800',
    },
    closed: {
      label: 'Closed',
      color: 'text-neutral-700 dark:text-neutral-300',
      icon: XCircle,
      bgColor: 'bg-neutral-100 dark:bg-neutral-900/30 border-neutral-200 dark:border-neutral-800',
    },
  };

  const priorityConfig: Record<string, { label: string; color: string }> = {
    urgent: { label: 'Urgent', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800' },
    high: { label: 'High', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border border-orange-200 dark:border-orange-800' },
    medium: { label: 'Medium', color: 'bg-primary-100 text-primary-900 dark:bg-primary-950/30 dark:text-primary-300 border border-primary-200 dark:border-primary-800' },
    low: { label: 'Low', color: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-900/30 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800' },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary-800 dark:text-primary-500 mx-auto mb-4" />
          <p className="text-neutral-600 dark:text-neutral-400">Loading problem details...</p>
        </div>
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-neutral-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">Problem not found</h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-4">The problem you're looking for doesn't exist.</p>
          <Link
            to="/problems"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-800 hover:bg-primary-900 text-white rounded-xl transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Problems
          </Link>
        </div>
      </div>
    );
  }

  const StatusIcon = statusConfig[problem.status]?.icon || AlertTriangle;

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/problems')}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-neutral-600 dark:text-neutral-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Problem Details</h1>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
              Created {formatDistanceToNow(new Date(problem.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={`/problems/${id}/edit`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
          >
            <Edit size={18} />
            Edit
          </Link>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-accent-700 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
          >
            <Trash2 size={18} />
            Delete
          </button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700 overflow-hidden"
      >
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
          <div className="flex items-start gap-4 mb-4">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center border ${statusConfig[problem.status]?.bgColor}`}>
              <StatusIcon size={28} className={statusConfig[problem.status]?.color} />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-3">{problem.title}</h2>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border ${statusConfig[problem.status]?.bgColor} ${statusConfig[problem.status]?.color}`}>
                  {statusConfig[problem.status]?.label}
                </span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${priorityConfig[problem.priority]?.color}`}>
                  {priorityConfig[problem.priority]?.label}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-neutral-100 dark:bg-neutral-900/50 flex items-center justify-center">
                <Users size={20} className="text-neutral-600 dark:text-neutral-400" />
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-500">Owner</p>
                <p className="text-sm font-medium text-neutral-900 dark:text-white">
                  {problem.owner?.full_name || 'Unassigned'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-neutral-100 dark:bg-neutral-900/50 flex items-center justify-center">
                <Users size={20} className="text-neutral-600 dark:text-neutral-400" />
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-500">Team</p>
                <p className="text-sm font-medium text-neutral-900 dark:text-white">
                  {problem.assigned_team?.name || 'Unassigned'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-neutral-100 dark:bg-neutral-900/50 flex items-center justify-center">
                <Ticket size={20} className="text-neutral-600 dark:text-neutral-400" />
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-500">Linked Tickets</p>
                <p className="text-sm font-medium text-neutral-900 dark:text-white">
                  {linkedTickets.length} {linkedTickets.length === 1 ? 'ticket' : 'tickets'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-b border-neutral-200 dark:border-neutral-700">
          <div className="flex gap-1 px-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 ${
                activeTab === 'overview'
                  ? 'border-primary-800 text-primary-800 dark:text-primary-500'
                  : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('tickets')}
              className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 ${
                activeTab === 'tickets'
                  ? 'border-primary-800 text-primary-800 dark:text-primary-500'
                  : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              Linked Tickets ({linkedTickets.length})
            </button>
            <button
              onClick={() => setActiveTab('timeline')}
              className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 ${
                activeTab === 'timeline'
                  ? 'border-primary-800 text-primary-800 dark:text-primary-500'
                  : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              Timeline
            </button>
          </div>
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                {problem.description && (
                  <div>
                    <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-3">Description</h3>
                    <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">{problem.description}</p>
                  </div>
                )}

                {problem.root_cause && (
                  <div className="p-4 bg-primary-50 dark:bg-primary-950/20 border border-primary-200 dark:border-primary-800 rounded-lg">
                    <h3 className="text-lg font-semibold text-primary-900 dark:text-primary-300 mb-3 flex items-center gap-2">
                      <FileText size={20} />
                      Root Cause Analysis
                    </h3>
                    <p className="text-primary-900 dark:text-primary-500 leading-relaxed whitespace-pre-wrap">{problem.root_cause}</p>
                  </div>
                )}

                {problem.workaround_md && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-300 mb-3 flex items-center gap-2">
                      <CheckCircle size={20} />
                      Workaround
                    </h3>
                    <p className="text-amber-800 dark:text-amber-400 leading-relaxed whitespace-pre-wrap">{problem.workaround_md}</p>
                  </div>
                )}

                {problem.resolution_md && (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <h3 className="text-lg font-semibold text-green-900 dark:text-green-300 mb-3 flex items-center gap-2">
                      <CheckCircle size={20} />
                      Resolution
                    </h3>
                    <p className="text-green-800 dark:text-green-400 leading-relaxed whitespace-pre-wrap">{problem.resolution_md}</p>
                  </div>
                )}

                <div className="pt-6 border-t border-neutral-200 dark:border-neutral-700">
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">Update Status</h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(statusConfig).map(([key, config]) => (
                      <button
                        key={key}
                        onClick={() => handleStatusUpdate(key)}
                        disabled={problem.status === key}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                          problem.status === key
                            ? `${config.bgColor} ${config.color} border cursor-not-allowed`
                            : 'bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:border-primary-500 dark:hover:border-primary-800'
                        }`}
                      >
                        {config.label}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'tickets' && (
              <motion.div
                key="tickets"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                {linkedTickets.length === 0 ? (
                  <div className="text-center py-12">
                    <Ticket className="w-16 h-16 text-neutral-400 mx-auto mb-4" />
                    <p className="text-neutral-600 dark:text-neutral-400">No tickets linked to this problem yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {linkedTickets.map((link) => (
                      <Link
                        key={link.id}
                        to={`/tickets/${link.ticket.id}`}
                        className="block p-4 bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:border-primary-300 dark:hover:border-primary-900 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Ticket size={16} className="text-neutral-500" />
                              <h4 className="font-medium text-neutral-900 dark:text-white">{link.ticket.subject}</h4>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-neutral-500">
                              <span className="px-2 py-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded">
                                {link.ticket.status}
                              </span>
                              <span className="px-2 py-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded">
                                {link.ticket.priority}
                              </span>
                              <span>{link.relationship_type}</span>
                            </div>
                          </div>
                          <LinkIcon size={16} className="text-neutral-400 flex-shrink-0" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'timeline' && (
              <motion.div
                key="timeline"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-950/30 flex items-center justify-center flex-shrink-0">
                      <Clock size={20} className="text-primary-800 dark:text-primary-500" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-neutral-900 dark:text-white">Problem Created</p>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400">
                        {format(new Date(problem.created_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                  </div>

                  {problem.resolved_at && (
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                        <CheckCircle size={20} className="text-success-600 dark:text-green-400" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-neutral-900 dark:text-white">Problem Resolved</p>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400">
                          {format(new Date(problem.resolved_at), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                    </div>
                  )}

                  {problem.closed_at && (
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-900/30 flex items-center justify-center flex-shrink-0">
                        <XCircle size={20} className="text-neutral-600 dark:text-neutral-400" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-neutral-900 dark:text-white">Problem Closed</p>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400">
                          {format(new Date(problem.closed_at), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setShowDeleteModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-neutral-800 rounded-xl shadow-xl max-w-md w-full p-6"
            >
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={24} className="text-accent-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-1">Delete Problem</h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    Are you sure you want to delete this problem? This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-accent-600 hover:bg-accent-700 text-white rounded-xl transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
