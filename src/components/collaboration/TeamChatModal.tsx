import { useState, useEffect, useRef } from 'react';
import { X, Send, Hash, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';
import { formatDistanceToNow } from 'date-fns';

interface TeamChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Channel {
  id: string;
  name: string;
  description: string;
  type: string;
}

interface Message {
  id: string;
  content: string;
  created_at: string;
  author: {
    full_name: string | null;
    email: string;
  };
}

export function TeamChatModal({ isOpen, onClose }: TeamChatModalProps) {
  const { profile } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchChannels();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedChannel) {
      fetchMessages();
      subscribeToMessages();
    }
  }, [selectedChannel]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchChannels = async () => {
    const { data } = await supabase
      .from('chat_channels')
      .select('*')
      .order('name');

    if (data && data.length > 0) {
      setChannels(data);
      setSelectedChannel(data[0]);
    }
  };

  const fetchMessages = async () => {
    if (!selectedChannel) return;

    const { data } = await supabase
      .from('chat_messages')
      .select(`
        id,
        content,
        created_at,
        author:profiles!chat_messages_author_id_fkey(full_name, email)
      `)
      .eq('channel_id', selectedChannel.id)
      .order('created_at', { ascending: true })
      .limit(50);

    if (data) {
      const mappedMessages = data.map(msg => ({
        ...msg,
        author: Array.isArray(msg.author) ? msg.author[0] : msg.author
      }));
      setMessages(mappedMessages as Message[]);
    }
  };

  const subscribeToMessages = () => {
    if (!selectedChannel) return;

    const subscription = supabase
      .channel(`chat:${selectedChannel.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `channel_id=eq.${selectedChannel.id}`,
        },
        async (payload) => {
          const { data: newMsg } = await supabase
            .from('chat_messages')
            .select(`
              id,
              content,
              created_at,
              author:profiles!chat_messages_author_id_fkey(full_name, email)
            `)
            .eq('id', payload.new.id)
            .single();

          if (newMsg) {
            const mappedMsg = {
              ...newMsg,
              author: Array.isArray(newMsg.author) ? newMsg.author[0] : newMsg.author
            };
            setMessages(prev => [...prev, mappedMsg as Message]);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChannel || !profile) return;

    setLoading(true);

    try {
      await supabase.from('chat_messages').insert({
        channel_id: selectedChannel.id,
        author_id: profile.id,
        content: newMessage.trim(),
        type: 'text',
      });

      await supabase.from('team_activities').insert({
        user_id: profile.id,
        action_type: 'message_sent',
        entity_type: 'chat_message',
        entity_id: selectedChannel.id,
        metadata: {
          channel_name: selectedChannel.name,
        },
      });

      setNewMessage('');
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl max-w-5xl w-full h-[600px] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-700">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">Team Chat</h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-64 border-r border-neutral-200 dark:border-neutral-700 overflow-y-auto">
            <div className="p-4">
              <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase mb-2">
                Channels
              </h3>
              <div className="space-y-1">
                {channels.map(channel => (
                  <button
                    key={channel.id}
                    onClick={() => setSelectedChannel(channel)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                      selectedChannel?.id === channel.id
                        ? 'bg-primary-50 dark:bg-primary-950/20 text-primary-900 dark:text-primary-300'
                        : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                    }`}
                  >
                    <Hash size={16} />
                    <span className="text-sm font-medium truncate">{channel.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col">
            {selectedChannel ? (
              <>
                <div className="p-4 border-b border-neutral-200 dark:border-neutral-700">
                  <div className="flex items-center gap-2">
                    <Hash size={20} className="text-neutral-500 dark:text-neutral-400" />
                    <h3 className="font-semibold text-neutral-900 dark:text-white">
                      {selectedChannel.name}
                    </h3>
                  </div>
                  {selectedChannel.description && (
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                      {selectedChannel.description}
                    </p>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.map(message => (
                    <div key={message.id} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-900 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                        {message.author?.full_name?.[0]?.toUpperCase() || message.author?.email[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="font-medium text-neutral-900 dark:text-white text-sm">
                            {message.author?.full_name || message.author?.email}
                          </span>
                          <span className="text-xs text-neutral-500 dark:text-neutral-400">
                            {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-sm text-neutral-700 dark:text-neutral-300 mt-1 break-words">
                          {message.content}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                <form onSubmit={handleSendMessage} className="p-4 border-t border-neutral-200 dark:border-neutral-700">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      placeholder={`Message #${selectedChannel.name}`}
                      className="flex-1 px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    <button
                      type="submit"
                      disabled={loading || !newMessage.trim()}
                      className="px-4 py-2 bg-success-600 hover:bg-success-700 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send size={20} />
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-neutral-500 dark:text-neutral-400">
                <div className="text-center">
                  <Users size={48} className="mx-auto mb-4 opacity-50" />
                  <p>Select a channel to start chatting</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
