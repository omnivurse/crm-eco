import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';
import {
  ArrowLeft,
  Clock,
  User,
  Calendar,
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  Paperclip,
  Send,
  Sparkles,
  MoreVertical,
  Link as LinkIcon,
  History,
  Timer,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { geminiSummarize, recommendNextAction, draftReply } from '../../lib/ai/gemini';

interface Ticket {
  id: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  type: string;
  impact: string;
  urgency: string;
  created_at: string;
  updated_at: string;
  sla_due_at: string;
  requester: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  assignee: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  service: {
    id: string;
    name: string;
  } | null;
}

interface Comment {
  id: string;
  body: string;
  is_internal: boolean;
  created_at: string;
  author: {
    full_name: string;
    email: string;
  } | null;
}

interface Event {
  id: string;
  event_type: string;
  payload: any;
  created_at: string;
  actor: {
    full_name: string;
    email: string;
  } | null;
}

interface RelatedItem {
  id: string;
  title: string;
  type: 'article' | 'problem' | 'change';
  relevance?: number;
}

export function AgentWorkspace() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [relatedItems, setRelatedItems] = useState<RelatedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState('');

  useEffect(() => {
    if (id) {
      fetchTicketDetails();
      fetchComments();
      fetchEvents();
      fetchRelatedItems();
    }
  }, [id]);

  const fetchTicketDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          requester:profiles!tickets_requester_id_fkey(id, full_name, email),
          assignee:profiles!tickets_assignee_id_fkey(id, full_name, email),
          service:services(id, name)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      setTicket(data);
    } catch (error) {
      console.error('Error fetching ticket:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('ticket_comments')
        .select(`
          *,
          author:profiles!ticket_comments_author_id_fkey(full_name, email)
        `)
        .eq('ticket_id', id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('ticket_events')
        .select(`
          *,
          actor:profiles(full_name, email)
        `)
        .eq('ticket_id', id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const fetchRelatedItems = async () => {
    try {
      // Fetch related KB articles
      const { data: articles } = await supabase
        .from('kb_articles')
        .select('id, title')
        .eq('is_published', true)
        .limit(5);

      const items: RelatedItem[] = (articles || []).map((a) => ({
        id: a.id,
        title: a.title,
        type: 'article' as const,
      }));

      setRelatedItems(items);
    } catch (error) {
      console.error('Error fetching related items:', error);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !profile) return;

    try {
      const { error } = await supabase.from('ticket_comments').insert({
        ticket_id: id,
        author_id: profile.id,
        body: newComment,
        is_internal: isInternal,
      });

      if (error) throw error;

      setNewComment('');
      fetchComments();

      // Log event
      await supabase.from('ticket_events').insert({
        ticket_id: id,
        event_type: 'comment_added',
        payload: { is_internal: isInternal },
        actor_id: profile.id,
      });
      fetchEvents();
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!ticket) return;

    try {
      const { error } = await supabase
        .from('tickets')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      // Log event
      await supabase.from('ticket_events').insert({
        ticket_id: id,
        event_type: 'status_changed',
        payload: { from: ticket.status, to: newStatus },
        actor_id: profile?.id,
      });

      fetchTicketDetails();
      fetchEvents();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleAssign = async () => {
    if (!profile) return;

    try {
      const { error } = await supabase
        .from('tickets')
        .update({ assignee_id: profile.id })
        .eq('id', id);

      if (error) throw error;

      await supabase.from('ticket_events').insert({
        ticket_id: id,
        event_type: 'assigned',
        payload: { assignee_id: profile.id },
        actor_id: profile.id,
      });

      fetchTicketDetails();
      fetchEvents();
    } catch (error) {
      console.error('Error assigning ticket:', error);
    }
  };

  const handleAiAction = async (action: string) => {
    if (!ticket) return;

    setAiLoading(true);
    setShowAiPanel(true);

    try {
      switch (action) {
        case 'summarize': {
          const contentToSummarize = `${ticket.subject}\n\n${ticket.description || ''}`;
          const summary = await geminiSummarize(contentToSummarize);
          setAiSuggestion(`**AI-Generated Summary:**\n\n${summary}`);
          break;
        }
        case 'suggest': {
          const recommendation = await recommendNextAction({
            summary: ticket.subject,
            description: ticket.description,
            priority: ticket.priority,
            status: ticket.status,
          });
          setAiSuggestion(
            `**Recommended Next Action:** ${recommendation.next_action}\n\n**Rationale:** ${recommendation.rationale}\n\n**Confidence:** ${(recommendation.confidence * 100).toFixed(0)}%`
          );
          break;
        }
        case 'draft': {
          const reply = await draftReply({
            summary: ticket.subject,
            description: ticket.description,
            priority: ticket.priority,
          });
          setAiSuggestion(`**AI-Generated Draft Reply:**\n\n${reply}\n\nBest regards,\n${profile?.full_name || 'Support Team'}`);
          break;
        }
      }
    } catch (error) {
      console.error('AI action error:', error);
      setAiSuggestion('Unable to generate AI suggestion at this time. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-neutral-500 dark:text-neutral-400">Loading ticket...</div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <AlertCircle className="text-neutral-400 mb-4" size={48} />
        <div className="text-neutral-500 dark:text-neutral-400">Ticket not found</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <button
        onClick={() => navigate('/tickets')}
        className="inline-flex items-center gap-2 mb-4 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
      >
        <ArrowLeft size={20} />
        Back to Tickets
      </button>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Ticket Header */}
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm text-neutral-500 dark:text-neutral-400">#{id?.slice(0, 8)}</span>
                  <span className={`px-2 py-1 text-xs font-medium rounded ${priorityColors[ticket.priority]}`}>
                    {ticket.priority}
                  </span>
                  <span className={`px-2 py-1 text-xs font-medium rounded ${statusColors[ticket.status]}`}>
                    {ticket.status}
                  </span>
                </div>
                <h1 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">{ticket.subject}</h1>
                <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-600 dark:text-neutral-400">
                  <span className="flex items-center gap-1">
                    <User size={16} />
                    {ticket.requester?.full_name || 'Unknown'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar size={16} />
                    {format(new Date(ticket.created_at), 'MMM d, yyyy HH:mm')}
                  </span>
                  {ticket.sla_due_at && (
                    <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                      <Timer size={16} />
                      SLA: {formatDistanceToNow(new Date(ticket.sla_due_at), { addSuffix: true })}
                    </span>
                  )}
                </div>
              </div>
              <button className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-xl">
                <MoreVertical size={20} />
              </button>
            </div>

            <div className="prose dark:prose-invert max-w-none">
              <p className="text-neutral-700 dark:text-neutral-300">{ticket.description}</p>
            </div>
          </div>

          {/* AI Quick Actions */}
          <div className="bg-gradient-to-r from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20 rounded-xl shadow p-4">
            <div className="flex items-center gap-3 mb-3">
              <Sparkles className="text-primary-800 dark:text-primary-500" size={20} />
              <h3 className="font-semibold text-neutral-900 dark:text-white">AI Assistant</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleAiAction('summarize')}
                disabled={aiLoading}
                className="px-3 py-1.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-xl text-sm hover:bg-neutral-50 dark:hover:bg-neutral-700 disabled:opacity-50"
              >
                Summarize Ticket
              </button>
              <button
                onClick={() => handleAiAction('suggest')}
                disabled={aiLoading}
                className="px-3 py-1.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-xl text-sm hover:bg-neutral-50 dark:hover:bg-neutral-700 disabled:opacity-50"
              >
                Suggest Next Action
              </button>
              <button
                onClick={() => handleAiAction('draft')}
                disabled={aiLoading}
                className="px-3 py-1.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-xl text-sm hover:bg-neutral-50 dark:hover:bg-neutral-700 disabled:opacity-50"
              >
                Draft Reply
              </button>
            </div>

            {showAiPanel && (
              <div className="mt-4 p-4 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700">
                {aiLoading ? (
                  <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-800 border-t-transparent"></div>
                    Processing...
                  </div>
                ) : (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <div dangerouslySetInnerHTML={{ __html: aiSuggestion.replace(/\n/g, '<br />') }} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow">
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                <History size={20} />
                Activity Timeline
              </h2>
            </div>

            <div className="p-6 space-y-6">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary-100 dark:bg-primary-950 rounded-full flex items-center justify-center">
                    <MessageSquare size={16} className="text-primary-800 dark:text-primary-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-neutral-900 dark:text-white">
                        {comment.author?.full_name || 'Unknown'}
                      </span>
                      {comment.is_internal && (
                        <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded">
                          Internal
                        </span>
                      )}
                      <span className="text-sm text-neutral-500 dark:text-neutral-400">
                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-neutral-700 dark:text-neutral-300">{comment.body}</p>
                  </div>
                </div>
              ))}

              {events.slice(0, 5).map((event) => (
                <div key={event.id} className="flex gap-4 opacity-75">
                  <div className="flex-shrink-0 w-8 h-8 bg-neutral-100 dark:bg-neutral-700 rounded-full flex items-center justify-center">
                    <History size={16} className="text-neutral-600 dark:text-neutral-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-neutral-600 dark:text-neutral-400">
                        {event.actor?.full_name || 'System'} {event.event_type.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-neutral-500 dark:text-neutral-500">
                        {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Comment */}
            <div className="p-6 border-t border-neutral-200 dark:border-neutral-700">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                rows={3}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-xl bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <div className="flex items-center justify-between mt-3">
                <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                  <input
                    type="checkbox"
                    checked={isInternal}
                    onChange={(e) => setIsInternal(e.target.checked)}
                    className="rounded border-neutral-300 dark:border-neutral-600"
                  />
                  Internal note
                </label>
                <button
                  onClick={handleAddComment}
                  disabled={!newComment.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary-800 hover:bg-primary-900 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
                >
                  <Send size={16} />
                  Add Comment
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow p-6">
            <h3 className="font-semibold text-neutral-900 dark:text-white mb-4">Quick Actions</h3>
            <div className="space-y-2">
              {!(ticket as any).assignee_id && (
                <button
                  onClick={handleAssign}
                  className="w-full px-4 py-2 bg-primary-800 hover:bg-primary-900 text-white rounded-xl transition-colors"
                >
                  Assign to Me
                </button>
              )}
              <select
                value={ticket.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-xl bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white"
              >
                <option value="new">New</option>
                <option value="open">Open</option>
                <option value="pending">Pending</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>

          {/* Ticket Details */}
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow p-6">
            <h3 className="font-semibold text-neutral-900 dark:text-white mb-4">Details</h3>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-neutral-500 dark:text-neutral-400">Assignee</dt>
                <dd className="text-neutral-900 dark:text-white font-medium">
                  {ticket.assignee?.full_name || 'Unassigned'}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500 dark:text-neutral-400">Service</dt>
                <dd className="text-neutral-900 dark:text-white font-medium">
                  {ticket.service?.name || 'None'}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500 dark:text-neutral-400">Type</dt>
                <dd className="text-neutral-900 dark:text-white font-medium capitalize">
                  {ticket.type || 'Incident'}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500 dark:text-neutral-400">Updated</dt>
                <dd className="text-neutral-900 dark:text-white font-medium">
                  {formatDistanceToNow(new Date(ticket.updated_at), { addSuffix: true })}
                </dd>
              </div>
            </dl>
          </div>

          {/* Related Items */}
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow p-6">
            <h3 className="font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
              <LinkIcon size={18} />
              Related Items
            </h3>
            {relatedItems.length === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">No related items found</p>
            ) : (
              <ul className="space-y-2">
                {relatedItems.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`/kb/${item.id}`}
                      className="text-sm text-primary-800 dark:text-primary-500 hover:underline"
                    >
                      {item.title}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
