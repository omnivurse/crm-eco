import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { User, Calendar, Paperclip, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';

interface Message {
  id: string;
  body: string;
  is_internal: boolean;
  created_at: string;
  author: {
    id: string;
    full_name: string;
    email: string;
    role: string;
  } | null;
}

interface StatusChange {
  id: string;
  old_status: string | null;
  new_status: string;
  created_at: string;
  changed_by: {
    full_name: string;
    email: string;
  } | null;
}

interface TicketConversationProps {
  ticketId: string;
  onNewMessage?: () => void;
}

export function TicketConversation({ ticketId, onNewMessage }: TicketConversationProps) {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [statusChanges, setStatusChanges] = useState<StatusChange[]>([]);
  const [loading, setLoading] = useState(true);

  const isStaff = profile?.role && ['staff', 'agent', 'admin', 'super_admin'].includes(profile.role);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchConversation(),
        fetchStatusChanges()
      ]);
      setLoading(false);
    };

    loadData();

    const messagesSubscription = supabase
      .channel(`ticket-messages-${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_comments',
          filter: `ticket_id=eq.${ticketId}`,
        },
        () => {
          fetchConversation();
          if (onNewMessage) onNewMessage();
        }
      )
      .subscribe();

    const statusSubscription = supabase
      .channel(`ticket-status-${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_status_history',
          filter: `ticket_id=eq.${ticketId}`,
        },
        () => {
          fetchStatusChanges();
        }
      )
      .subscribe();

    return () => {
      messagesSubscription.unsubscribe();
      statusSubscription.unsubscribe();
    };
  }, [ticketId]);

  const fetchConversation = async () => {
    try {
      const { data, error } = await supabase
        .from('ticket_comments')
        .select(`
          id,
          body,
          is_internal,
          created_at,
          author:profiles!ticket_comments_author_id_fkey(
            id,
            full_name,
            email,
            role
          )
        `)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const filteredMessages = (data || []).filter((msg: any) => {
        if (msg.is_internal && !isStaff) return false;
        return true;
      });

      const mappedMessages = filteredMessages.map((msg: any) => ({
        ...msg,
        author: Array.isArray(msg.author) ? msg.author[0] : msg.author
      }));

      setMessages(mappedMessages as Message[]);
    } catch (error) {
      console.error('Error fetching conversation:', error);
    }
  };

  const fetchStatusChanges = async () => {
    try {
      const { data, error } = await supabase
        .from('ticket_status_history')
        .select(`
          id,
          old_status,
          new_status,
          created_at,
          changed_by:profiles!ticket_status_history_changed_by_fkey(
            full_name,
            email
          )
        `)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const mappedChanges = (data || []).map((change: any) => ({
        ...change,
        changed_by: Array.isArray(change.changed_by) ? change.changed_by[0] : change.changed_by
      }));

      setStatusChanges(mappedChanges as StatusChange[]);
    } catch (error) {
      console.error('Error fetching status changes:', error);
    }
  };

  const mergeTimeline = () => {
    const timeline: Array<{ type: 'message' | 'status'; data: any; timestamp: string }> = [];

    messages.forEach(msg => {
      timeline.push({
        type: 'message',
        data: msg,
        timestamp: msg.created_at
      });
    });

    statusChanges.forEach(change => {
      timeline.push({
        type: 'status',
        data: change,
        timestamp: change.created_at
      });
    });

    return timeline.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  };

  const getAuthorDisplay = (author: Message['author']) => {
    if (!author) return 'System';
    return author.full_name || author.email;
  };

  const getAuthorInitials = (author: Message['author']) => {
    if (!author) return 'SY';
    const name = author.full_name || author.email;
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
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
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary-800 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const timeline = mergeTimeline();

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
        Conversation
      </h3>

      <div className="space-y-4">
        {timeline.length === 0 ? (
          <div className="text-center py-8 text-neutral-500 dark:text-neutral-400">
            No messages yet
          </div>
        ) : (
          timeline.map((item, index) => {
            if (item.type === 'status') {
              const change = item.data as StatusChange;
              return (
                <div key={`status-${change.id}`} className="flex items-center justify-center">
                  <div className="flex items-center space-x-2 px-4 py-2 bg-neutral-100 dark:bg-neutral-700 rounded-full text-sm">
                    <Calendar size={14} className="text-neutral-500 dark:text-neutral-400" />
                    <span className="text-neutral-600 dark:text-neutral-300">
                      Status changed from{' '}
                      <span className={`px-2 py-0.5 rounded ${getStatusColor(change.old_status || 'new')}`}>
                        {change.old_status || 'new'}
                      </span>
                      {' '}to{' '}
                      <span className={`px-2 py-0.5 rounded ${getStatusColor(change.new_status)}`}>
                        {change.new_status}
                      </span>
                    </span>
                    <span className="text-neutral-500 dark:text-neutral-400 text-xs">
                      {format(new Date(change.created_at), 'MMM d, h:mm a')}
                    </span>
                  </div>
                </div>
              );
            }

            const message = item.data as Message;
            const isCurrentUser = message.author?.id === profile?.id;
            const isStaffMessage = message.author?.role &&
              ['staff', 'agent', 'admin', 'super_admin'].includes(message.author.role);

            return (
              <div
                key={`message-${message.id}`}
                className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex gap-3 max-w-3xl ${isCurrentUser ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${
                    isStaffMessage
                      ? 'bg-primary-800'
                      : 'bg-neutral-500'
                  }`}>
                    {getAuthorInitials(message.author)}
                  </div>

                  <div className={`flex-1 ${isCurrentUser ? 'text-right' : 'text-left'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      {!isCurrentUser && (
                        <span className="font-medium text-neutral-900 dark:text-white">
                          {getAuthorDisplay(message.author)}
                        </span>
                      )}
                      {isStaffMessage && (
                        <span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-950 text-primary-900 dark:text-primary-200 text-xs rounded">
                          Support Team
                        </span>
                      )}
                      {message.is_internal && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 text-xs rounded">
                          <Lock size={12} />
                          Internal Note
                        </span>
                      )}
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">
                        {format(new Date(message.created_at), 'MMM d, h:mm a')}
                      </span>
                    </div>

                    <div className={`rounded-lg px-4 py-3 ${
                      isCurrentUser
                        ? 'bg-primary-800 text-white'
                        : message.is_internal
                        ? 'bg-amber-50 dark:bg-amber-900/20 text-neutral-900 dark:text-neutral-100 border border-amber-200 dark:border-amber-800'
                        : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-900 dark:text-white'
                    }`}>
                      <p className="whitespace-pre-wrap break-words">
                        {message.body}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
