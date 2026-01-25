import { useState, useEffect } from 'react';
import { X, ExternalLink, User, Calendar, Tag as TagIcon, AlertCircle, Clock, Edit2, Save } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';
import { TicketConversation } from './TicketConversation';
import { MessageComposer } from './MessageComposer';
import { TicketAttachmentsViewer } from './TicketAttachmentsViewer';

interface Ticket {
  id: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  created_at: string;
  updated_at: string;
  requester?: { full_name: string; email: string; } | null;
  assignee?: { id: string; full_name: string; email: string; } | null;
}

interface TicketQuickViewProps {
  ticketId: string;
  isOpen: boolean;
  onClose: () => void;
  onOpenFullView?: () => void;
}

export function TicketQuickView({ ticketId, isOpen, onClose, onOpenFullView }: TicketQuickViewProps) {
  const { profile } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedStatus, setEditedStatus] = useState('');
  const [editedPriority, setEditedPriority] = useState('');
  const [saving, setSaving] = useState(false);

  const isStaff = profile?.role && ['staff', 'agent', 'admin', 'super_admin'].includes(profile.role);

  useEffect(() => {
    if (isOpen && ticketId) {
      fetchTicket();
    }
  }, [isOpen, ticketId]);

  const fetchTicket = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          id, subject, description, status, priority, category, created_at, updated_at,
          requester:profiles!tickets_requester_id_fkey(full_name, email),
          assignee:profiles!tickets_assignee_id_fkey(id, full_name, email)
        `)
        .eq('id', ticketId)
        .maybeSingle();

      if (error) throw error;
      if (!data) { setError('Ticket not found'); return; }

      setTicket(data as any);
      setEditedSubject(data.subject);
      setEditedStatus(data.status);
      setEditedPriority(data.priority);
    } catch (err: any) {
      setError(err.message || 'Failed to load ticket');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!ticket) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ subject: editedSubject, status: editedStatus, priority: editedPriority, updated_at: new Date().toISOString() })
        .eq('id', ticket.id);
      if (error) throw error;
      await fetchTicket();
      setIsEditing(false);
    } catch (err: any) {
      alert('Failed to update ticket: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700">
          <span className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">
            #{ticketId.substring(0, 8)}
          </span>
          <div className="flex items-center gap-2">
            {onOpenFullView && (
              <button onClick={onOpenFullView} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl" title="Open full view">
                <ExternalLink size={20} className="text-neutral-600 dark:text-neutral-400" />
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl">
              <X size={20} className="text-neutral-600 dark:text-neutral-400" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-10 h-10 border-4 border-primary-800 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : error || !ticket ? (
          <div className="text-center py-16 px-6">
            <AlertCircle className="mx-auto text-accent-500 mb-4" size={48} />
            <p className="text-neutral-600 dark:text-neutral-400">{error || 'Ticket not found'}</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editedSubject}
                        onChange={(e) => setEditedSubject(e.target.value)}
                        className="w-full text-2xl font-bold bg-neutral-100 dark:bg-neutral-800 rounded-xl px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                      />
                    ) : (
                      <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">{ticket.subject}</h2>
                    )}
                  </div>
                  {isStaff && (
                    <div className="flex items-center gap-2 ml-4">
                      {isEditing ? (
                        <>
                          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-3 py-2 bg-primary-800 hover:bg-primary-900 text-white rounded-xl disabled:opacity-50">
                            <Save size={16} /> Save
                          </button>
                          <button onClick={() => { setIsEditing(false); setEditedSubject(ticket.subject); setEditedStatus(ticket.status); setEditedPriority(ticket.priority); }}
                            className="px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800">
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800">
                          <Edit2 size={16} /> Edit
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-6">
                  {isEditing ? (
                    <>
                      <select value={editedStatus} onChange={(e) => setEditedStatus(e.target.value)}
                        className="px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 border rounded-xl text-sm font-medium">
                        <option value="new">New</option><option value="open">Open</option><option value="pending">Pending</option>
                        <option value="resolved">Resolved</option><option value="closed">Closed</option>
                      </select>
                      <select value={editedPriority} onChange={(e) => setEditedPriority(e.target.value)}
                        className="px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 border rounded-xl text-sm font-medium">
                        <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
                      </select>
                    </>
                  ) : (
                    <>
                      <span className={`modern-badge ${getStatusColor(ticket.status)}`}>{ticket.status}</span>
                      <span className={`modern-badge ${getPriorityColor(ticket.priority)}`}>{ticket.priority} priority</span>
                      {ticket.category && <span className="modern-badge bg-neutral-100 dark:bg-neutral-700">{ticket.category}</span>}
                    </>
                  )}
                </div>

                {ticket.description && (
                  <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-xl mb-6">
                    <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">Description</h3>
                    <p className="text-neutral-900 dark:text-white whitespace-pre-wrap">{ticket.description}</p>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    Attachments
                  </h3>
                  <TicketAttachmentsViewer ticketId={ticket.id} />
                </div>

                <div className="border-t border-neutral-200 dark:border-neutral-700 pt-6">
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-4">Conversation</h3>
                  <TicketConversation ticketId={ticket.id} onNewMessage={fetchTicket} />
                </div>
              </div>
            </div>

            <div className="border-t border-neutral-200 dark:border-neutral-700 p-6 bg-neutral-50 dark:bg-neutral-900/50">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white mb-3">Reply</h3>
              <MessageComposer ticketId={ticket.id} onMessageSent={fetchTicket} allowInternal={isStaff} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
