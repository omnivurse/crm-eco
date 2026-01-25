import { useState, useEffect, useRef } from 'react';
import { X, Send, MessageSquare, Clock, User, StickyNote, Zap, ExternalLink, Minimize2, Maximize2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatSession {
  id: string;
  visitor_id: string;
  customer_name: string | null;
  customer_email: string | null;
  status: 'waiting' | 'active' | 'ended';
  started_at: string;
  ended_at: string | null;
  metadata: any;
  assigned_agent_id: string | null;
  ticket_id: string | null;
}

interface Message {
  id: string;
  sender_type: 'customer' | 'agent' | 'system';
  sender_name: string | null;
  sender_email: string | null;
  message_body: string;
  created_at: string;
  metadata: any;
}

interface SessionNote {
  id: string;
  note: string;
  created_at: string;
  agent: {
    full_name: string | null;
    email: string;
  };
}

interface QuickResponse {
  id: string;
  title: string;
  content: string;
  category: string;
}

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSessionId?: string;
}

export function ChatModal({ isOpen, onClose, initialSessionId }: ChatModalProps) {
  const { profile } = useAuth();
  const [activeSessions, setActiveSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [notes, setNotes] = useState<SessionNote[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [newNote, setNewNote] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [showQuickResponses, setShowQuickResponses] = useState(false);
  const [quickResponses, setQuickResponses] = useState<QuickResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && profile) {
      fetchActiveSessions();
      fetchQuickResponses();
    }
  }, [isOpen, profile]);

  useEffect(() => {
    if (initialSessionId && activeSessions.length > 0) {
      const session = activeSessions.find(s => s.id === initialSessionId);
      if (session) setSelectedSession(session);
    } else if (activeSessions.length > 0 && !selectedSession) {
      setSelectedSession(activeSessions[0]);
    }
  }, [initialSessionId, activeSessions]);

  useEffect(() => {
    if (selectedSession) {
      fetchMessages();
      fetchNotes();
      subscribeToMessages();
    }
  }, [selectedSession]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchActiveSessions = async () => {
    if (!profile) return;

    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('assigned_agent_id', profile.id)
      .in('status', ['active', 'waiting'])
      .order('started_at', { ascending: false });

    if (data) {
      setActiveSessions(data);
    }
  };

  const fetchMessages = async () => {
    if (!selectedSession) return;

    const { data } = await supabase
      .from('channel_messages')
      .select('*')
      .eq('metadata->>session_id', selectedSession.id)
      .order('created_at', { ascending: true });

    if (data) {
      setMessages(data);
    }
  };

  const fetchNotes = async () => {
    if (!selectedSession) return;

    const { data } = await supabase
      .from('chat_session_notes')
      .select(`
        id,
        note,
        created_at,
        agent:profiles!chat_session_notes_agent_id_fkey(full_name, email)
      `)
      .eq('session_id', selectedSession.id)
      .order('created_at', { ascending: false });

    if (data) {
      const mappedNotes = data.map(note => ({
        ...note,
        agent: Array.isArray(note.agent) ? note.agent[0] : note.agent
      }));
      setNotes(mappedNotes as SessionNote[]);
    }
  };

  const fetchQuickResponses = async () => {
    const { data } = await supabase
      .from('chat_quick_responses')
      .select('*')
      .eq('is_active', true)
      .order('usage_count', { ascending: false })
      .limit(10);

    if (data) {
      setQuickResponses(data);
    }
  };

  const subscribeToMessages = () => {
    if (!selectedSession) return;

    const channel = supabase
      .channel(`chat-messages:${selectedSession.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'channel_messages',
          filter: `metadata->>session_id=eq.${selectedSession.id}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedSession || !profile) return;

    setLoading(true);
    try {
      await supabase.from('channel_messages').insert({
        channel_id: null,
        ticket_id: selectedSession.ticket_id,
        sender_type: 'agent',
        sender_id: profile.id,
        sender_name: profile.full_name,
        sender_email: profile.email,
        message_body: newMessage.trim(),
        metadata: { session_id: selectedSession.id },
      });

      setNewMessage('');
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !selectedSession || !profile) return;

    try {
      await supabase.from('chat_session_notes').insert({
        session_id: selectedSession.id,
        agent_id: profile.id,
        note: newNote.trim(),
      });

      setNewNote('');
      fetchNotes();
    } catch (err) {
      console.error('Error adding note:', err);
    }
  };

  const handleEndSession = async () => {
    if (!selectedSession) return;

    try {
      await supabase
        .from('chat_sessions')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', selectedSession.id);

      fetchActiveSessions();
      setSelectedSession(null);
    } catch (err) {
      console.error('Error ending session:', err);
    }
  };

  const insertQuickResponse = async (content: string, responseId: string) => {
    setNewMessage(content);
    setShowQuickResponses(false);

    // Increment usage count
    try {
      await supabase.rpc('increment_quick_response_usage', { response_id: responseId });
    } catch (err) {
      console.error('Error incrementing usage count:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{
          opacity: 1,
          scale: 1,
          y: 0,
          height: isMinimized ? 'auto' : '85vh'
        }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="glass-card max-w-6xl w-full flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200/50 dark:border-neutral-700/50 bg-gradient-to-r from-primary-50/50 to-primary-100/50 dark:from-primary-900/20 dark:to-primary-900/20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-900 flex items-center justify-center floating">
              <MessageSquare className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Live Chat Sessions</h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {activeSessions.length} active {activeSessions.length === 1 ? 'session' : 'sessions'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-2 hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50 rounded-lg transition-colors"
            >
              {isMinimized ? <Maximize2 size={20} /> : <Minimize2 size={20} />}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50 rounded-lg transition-colors text-neutral-600 dark:text-neutral-400"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <div className="flex flex-1 overflow-hidden">
            {/* Session Switcher Sidebar */}
            <div className="w-72 border-r border-neutral-200/50 dark:border-neutral-700/50 overflow-y-auto bg-neutral-50/50 dark:bg-neutral-800/50">
              <div className="p-4">
                <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase mb-3">
                  Your Active Chats
                </h3>
                <div className="space-y-2">
                  {activeSessions.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => setSelectedSession(session)}
                      className={`w-full text-left p-3 rounded-xl transition-all ${
                        selectedSession?.id === session.id
                          ? 'bg-gradient-to-r from-primary-500 to-primary-900 text-white shadow-lg'
                          : 'bg-white dark:bg-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-600 text-neutral-900 dark:text-white'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {session.customer_name || session.customer_email || 'Anonymous'}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-xs opacity-90">
                            <Clock size={12} />
                            <span>{formatDistanceToNow(new Date(session.started_at), { addSuffix: true })}</span>
                          </div>
                        </div>
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            session.status === 'active'
                              ? 'bg-success-500/20 text-success-700 dark:text-green-300'
                              : 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300'
                          }`}
                        >
                          {session.status}
                        </span>
                      </div>
                    </button>
                  ))}
                  {activeSessions.length === 0 && (
                    <div className="text-center py-8 text-neutral-500 dark:text-neutral-400">
                      <MessageSquare size={48} className="mx-auto mb-3 opacity-50" />
                      <p className="text-sm">No active chat sessions</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Main Chat Area */}
            {selectedSession ? (
              <div className="flex-1 flex flex-col">
                {/* Chat Header */}
                <div className="p-4 border-b border-neutral-200/50 dark:border-neutral-700/50 bg-white/50 dark:bg-neutral-800/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-900 flex items-center justify-center text-white font-semibold">
                        {selectedSession.customer_name?.[0]?.toUpperCase() || 'A'}
                      </div>
                      <div>
                        <h3 className="font-semibold text-neutral-900 dark:text-white">
                          {selectedSession.customer_name || 'Anonymous User'}
                        </h3>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400">
                          {selectedSession.customer_email || 'No email provided'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowNotes(!showNotes)}
                        className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
                          showNotes
                            ? 'bg-primary-800 text-white'
                            : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
                        }`}
                      >
                        <StickyNote size={18} />
                        Notes
                      </button>
                      <button
                        onClick={handleEndSession}
                        className="px-4 py-2 bg-accent-600 hover:bg-accent-700 text-white rounded-xl transition-colors"
                      >
                        End Chat
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                  {/* Messages Area */}
                  <div className="flex-1 flex flex-col">
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      <AnimatePresence>
                        {messages.map((message) => (
                          <motion.div
                            key={message.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex gap-3 ${
                              message.sender_type === 'agent' ? 'flex-row-reverse' : ''
                            }`}
                          >
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 ${
                                message.sender_type === 'agent'
                                  ? 'bg-gradient-to-br from-green-500 to-teal-500'
                                  : 'bg-gradient-to-br from-primary-500 to-primary-900'
                              }`}
                            >
                              {message.sender_name?.[0]?.toUpperCase() || 'A'}
                            </div>
                            <div
                              className={`max-w-[70%] ${
                                message.sender_type === 'agent' ? 'items-end' : 'items-start'
                              }`}
                            >
                              <div className="flex items-baseline gap-2 mb-1">
                                <span className="text-sm font-medium text-neutral-900 dark:text-white">
                                  {message.sender_name || 'Anonymous'}
                                </span>
                                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                                  {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                                </span>
                              </div>
                              <div
                                className={`p-3 rounded-2xl ${
                                  message.sender_type === 'agent'
                                    ? 'bg-gradient-to-r from-primary-500 to-primary-900 text-white'
                                    : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-white'
                                }`}
                              >
                                <p className="text-sm break-words">{message.message_body}</p>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Quick Responses */}
                    {showQuickResponses && (
                      <div className="border-t border-neutral-200/50 dark:border-neutral-700/50 p-4 bg-neutral-50/50 dark:bg-neutral-800/50">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">Quick Responses</h4>
                          <button
                            onClick={() => setShowQuickResponses(false)}
                            className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                          >
                            Close
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                          {quickResponses.map((response) => (
                            <button
                              key={response.id}
                              onClick={() => insertQuickResponse(response.content, response.id)}
                              className="p-3 text-left rounded-lg bg-white dark:bg-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-600 transition-colors border border-neutral-200 dark:border-neutral-600"
                            >
                              <p className="text-sm font-medium text-neutral-900 dark:text-white mb-1">
                                {response.title}
                              </p>
                              <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2">
                                {response.content}
                              </p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Message Input */}
                    <form onSubmit={handleSendMessage} className="p-4 border-t border-neutral-200/50 dark:border-neutral-700/50">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setShowQuickResponses(!showQuickResponses)}
                          className="p-3 bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 rounded-lg transition-colors"
                          title="Quick Responses"
                        >
                          <Zap size={20} className="text-neutral-700 dark:text-neutral-300" />
                        </button>
                        <input
                          type="text"
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder="Type your message..."
                          className="flex-1 px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                        <button
                          type="submit"
                          disabled={loading || !newMessage.trim()}
                          className="px-6 py-3 bg-gradient-to-r from-primary-700 to-cyan-600 hover:from-primary-800 hover:to-cyan-700 text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          <Send size={20} />
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Notes Sidebar */}
                  {showNotes && (
                    <div className="w-80 border-l border-neutral-200/50 dark:border-neutral-700/50 bg-neutral-50/50 dark:bg-neutral-800/50 flex flex-col">
                      <div className="p-4 border-b border-neutral-200/50 dark:border-neutral-700/50">
                        <h3 className="font-semibold text-neutral-900 dark:text-white">Internal Notes</h3>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {notes.map((note) => (
                          <div key={note.id} className="p-3 bg-white dark:bg-neutral-700 rounded-lg">
                            <p className="text-sm text-neutral-900 dark:text-white mb-2">{note.note}</p>
                            <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                              <User size={12} />
                              <span>{note.agent.full_name || note.agent.email}</span>
                              <span>•</span>
                              <span>{formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="p-4 border-t border-neutral-200/50 dark:border-neutral-700/50">
                        <textarea
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          placeholder="Add internal note..."
                          className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                          rows={3}
                        />
                        <button
                          onClick={handleAddNote}
                          disabled={!newNote.trim()}
                          className="w-full mt-2 px-4 py-2 bg-primary-800 hover:bg-primary-900 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Add Note
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-neutral-500 dark:text-neutral-400">
                <div className="text-center">
                  <MessageSquare size={64} className="mx-auto mb-4 opacity-50" />
                  <p>Select a chat session to begin</p>
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
