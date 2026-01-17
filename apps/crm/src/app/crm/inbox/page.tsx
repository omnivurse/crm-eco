'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import {
  Mail,
  MessageSquare,
  Phone,
  MessageCircle,
  Search,
  Star,
  StarOff,
  Inbox as InboxIcon,
  Filter,
  Plus,
  MoreVertical,
  Trash2,
  Archive,
  Reply,
  Forward,
  Clock,
  Check,
  CheckCheck,
  Loader2,
  X,
  Send,
  Paperclip,
  User,
} from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@crm-eco/ui/components/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';

// Message types
type MessageType = 'email' | 'sms' | 'whatsapp' | 'call';
type FilterType = 'all' | 'unread' | 'starred';

interface Message {
  id: string;
  type: MessageType;
  from: {
    name: string;
    email?: string;
    phone?: string;
    avatar?: string;
  };
  subject: string;
  preview: string;
  content: string;
  timestamp: Date;
  read: boolean;
  starred: boolean;
  isNew?: boolean;
  status?: 'sent' | 'delivered' | 'read';
}

const TYPE_ICONS: Record<MessageType, React.ReactNode> = {
  email: <Mail className="w-4 h-4" />,
  sms: <MessageSquare className="w-4 h-4" />,
  whatsapp: <MessageCircle className="w-4 h-4" />,
  call: <Phone className="w-4 h-4" />,
};

const TYPE_COLORS: Record<MessageType, string> = {
  email: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-500/20',
  sms: 'text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-500/20',
  whatsapp: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-500/20',
  call: 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-500/20',
};

// Mock messages for demo
const MOCK_MESSAGES: Message[] = [
  {
    id: '1',
    type: 'email',
    from: { name: 'Sarah Johnson', email: 'sarah@example.com' },
    subject: 'Question about Medicare Advantage plans',
    preview: 'Hi, I\'m interested in learning more about the Medicare Advantage...',
    content: 'Hi,\n\nI\'m interested in learning more about the Medicare Advantage plans you offer. Could you please provide me with more details about coverage options and pricing?\n\nI\'m particularly interested in:\n- Prescription drug coverage\n- Vision and dental benefits\n- Out-of-pocket maximums\n\nThank you for your help!\n\nBest regards,\nSarah Johnson',
    timestamp: new Date(Date.now() - 1800000), // 30 min ago
    read: false,
    starred: false,
    isNew: true,
  },
  {
    id: '2',
    type: 'call',
    from: { name: 'Emma Davis', phone: '+1 (555) 123-4567' },
    subject: 'Missed Call',
    preview: 'Callback requested regarding policy changes',
    content: 'Missed call from Emma Davis. Callback requested regarding policy changes and renewal options.',
    timestamp: new Date(Date.now() - 172800000), // 2 days ago
    read: true,
    starred: false,
  },
  {
    id: '3',
    type: 'sms',
    from: { name: 'David Wilson', phone: '+1 (555) 987-6543' },
    subject: 'SMS: Ready to proceed',
    preview: 'Yes, I\'m ready to move forward with the enrollment. W...',
    content: 'Yes, I\'m ready to move forward with the enrollment. When is the best time to complete the paperwork?',
    timestamp: new Date(Date.now() - 259200000), // 3 days ago
    read: true,
    starred: true,
  },
  {
    id: '4',
    type: 'whatsapp',
    from: { name: 'Michael Brown', phone: '+1 (555) 456-7890' },
    subject: 'WhatsApp: Documents received',
    preview: 'Thanks for sending the documents. I\'ll review them...',
    content: 'Thanks for sending the documents. I\'ll review them and get back to you by tomorrow with any questions.',
    timestamp: new Date(Date.now() - 345600000), // 4 days ago
    read: true,
    starred: false,
  },
  {
    id: '5',
    type: 'email',
    from: { name: 'Jennifer Lee', email: 'j.lee@company.com' },
    subject: 'Re: Annual review meeting',
    preview: 'Looking forward to our meeting next week. Please let me know if...',
    content: 'Looking forward to our meeting next week. Please let me know if there\'s anything specific you\'d like me to prepare beforehand.\n\nBest,\nJennifer',
    timestamp: new Date(Date.now() - 432000000), // 5 days ago
    read: true,
    starred: true,
  },
];

export default function InboxPage() {
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [typeFilter, setTypeFilter] = useState<MessageType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showComposeModal, setShowComposeModal] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Load messages
  useEffect(() => {
    async function loadMessages() {
      try {
        // In production, load from database
        // For now, use mock data
        setMessages(MOCK_MESSAGES);
      } catch (error) {
        console.error('Error loading messages:', error);
      } finally {
        setLoading(false);
      }
    }

    loadMessages();
  }, []);

  // Filter messages
  const filteredMessages = messages.filter((msg) => {
    // Filter by status
    if (filter === 'unread' && msg.read) return false;
    if (filter === 'starred' && !msg.starred) return false;

    // Filter by type
    if (typeFilter !== 'all' && msg.type !== typeFilter) return false;

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        msg.from.name.toLowerCase().includes(query) ||
        msg.subject.toLowerCase().includes(query) ||
        msg.preview.toLowerCase().includes(query)
      );
    }

    return true;
  });

  // Count functions
  const unreadCount = messages.filter((m) => !m.read).length;
  const starredCount = messages.filter((m) => m.starred).length;

  // Toggle starred
  const toggleStarred = (id: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, starred: !m.starred } : m))
    );
  };

  // Mark as read
  const markAsRead = (id: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, read: true } : m))
    );
  };

  // Format timestamp
  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return `${days} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  // Get initials
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Select message
  const handleSelectMessage = (msg: Message) => {
    setSelectedMessage(msg);
    if (!msg.read) {
      markAsRead(msg.id);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Inbox</h1>
          <p className="text-slate-500 dark:text-slate-400">Manage all your communications in one place</p>
        </div>
        <button
          onClick={() => setShowComposeModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Compose
        </button>
      </div>

      {/* Main Content */}
      <div className="flex gap-6 h-[calc(100%-5rem)]">
        {/* Filters Sidebar */}
        <div className="w-56 flex-shrink-0 space-y-6">
          {/* Status Filters */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Filters</h3>
            <div className="space-y-1">
              <button
                onClick={() => setFilter('all')}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  filter === 'all'
                    ? 'bg-teal-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                )}
              >
                <div className="flex items-center gap-2">
                  <InboxIcon className="w-4 h-4" />
                  All Messages
                </div>
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full',
                  filter === 'all' ? 'bg-teal-500' : 'bg-slate-200 dark:bg-slate-700'
                )}>
                  {messages.length}
                </span>
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  filter === 'unread'
                    ? 'bg-teal-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                )}
              >
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Unread
                </div>
                {unreadCount > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-500 text-white">
                    {unreadCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setFilter('starred')}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  filter === 'starred'
                    ? 'bg-teal-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                )}
              >
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4" />
                  Starred
                </div>
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full',
                  filter === 'starred' ? 'bg-teal-500' : 'bg-slate-200 dark:bg-slate-700'
                )}>
                  {starredCount}
                </span>
              </button>
            </div>
          </div>

          {/* Type Filters */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Type</h3>
            <div className="space-y-1">
              {[
                { key: 'all' as const, label: 'All Types', icon: <Filter className="w-4 h-4" /> },
                { key: 'whatsapp' as const, label: 'WhatsApp', icon: <MessageCircle className="w-4 h-4" /> },
                { key: 'email' as const, label: 'Email', icon: <Mail className="w-4 h-4" /> },
                { key: 'call' as const, label: 'Calls', icon: <Phone className="w-4 h-4" /> },
                { key: 'sms' as const, label: 'SMS', icon: <MessageSquare className="w-4 h-4" /> },
              ].map((type) => (
                <button
                  key={type.key}
                  onClick={() => setTypeFilter(type.key)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    typeFilter === type.key
                      ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  )}
                >
                  {type.icon}
                  {type.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Message List */}
        <div className="w-96 flex-shrink-0 glass-card border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden flex flex-col">
          {/* Search */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search messages..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto">
            {filteredMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <InboxIcon className="w-12 h-12 mb-3 opacity-50" />
                <p className="text-sm">No messages found</p>
              </div>
            ) : (
              filteredMessages.map((msg) => (
                <button
                  key={msg.id}
                  onClick={() => handleSelectMessage(msg)}
                  className={cn(
                    'w-full text-left p-4 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors',
                    selectedMessage?.id === msg.id && 'bg-teal-50 dark:bg-teal-900/20',
                    !msg.read && 'bg-blue-50/50 dark:bg-blue-900/10'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="w-10 h-10 flex-shrink-0">
                      <AvatarImage src={msg.from.avatar} />
                      <AvatarFallback className={cn(
                        'text-xs font-medium',
                        TYPE_COLORS[msg.type]
                      )}>
                        {getInitials(msg.from.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn(
                          'text-sm truncate',
                          !msg.read ? 'font-semibold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-300'
                        )}>
                          {msg.from.name}
                        </span>
                        <span className="text-xs text-slate-500 flex-shrink-0">{formatTime(msg.timestamp)}</span>
                      </div>
                      <p className={cn(
                        'text-sm truncate',
                        !msg.read ? 'font-medium text-slate-800 dark:text-slate-200' : 'text-slate-600 dark:text-slate-400'
                      )}>
                        {msg.subject}
                      </p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{msg.preview}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={cn('p-1 rounded', TYPE_COLORS[msg.type])}>
                          {TYPE_ICONS[msg.type]}
                        </span>
                        {msg.isNew && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500 text-white">New</span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Message Detail */}
        <div className="flex-1 glass-card border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden flex flex-col">
          {selectedMessage ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={selectedMessage.from.avatar} />
                      <AvatarFallback className={cn('text-sm font-medium', TYPE_COLORS[selectedMessage.type])}>
                        {getInitials(selectedMessage.from.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white">{selectedMessage.from.name}</h3>
                      <p className="text-sm text-slate-500">
                        {selectedMessage.from.email || selectedMessage.from.phone}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleStarred(selectedMessage.id)}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      {selectedMessage.starred ? (
                        <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                      ) : (
                        <StarOff className="w-5 h-5 text-slate-400" />
                      )}
                    </button>
                    <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                      <Archive className="w-5 h-5 text-slate-400" />
                    </button>
                    <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-red-500">
                      <Trash2 className="w-5 h-5" />
                    </button>
                    <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                      <MoreVertical className="w-5 h-5 text-slate-400" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Subject */}
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className={cn('p-1.5 rounded', TYPE_COLORS[selectedMessage.type])}>
                    {TYPE_ICONS[selectedMessage.type]}
                  </span>
                  <h2 className="font-medium text-slate-900 dark:text-white">{selectedMessage.subject}</h2>
                </div>
                <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" />
                  {selectedMessage.timestamp.toLocaleString()}
                </p>
              </div>

              {/* Content */}
              <div className="flex-1 p-6 overflow-y-auto">
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                  {selectedMessage.content}
                </div>
              </div>

              {/* Reply Actions */}
              <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                <div className="flex gap-2">
                  <button className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
                    <Reply className="w-4 h-4" />
                    Reply
                  </button>
                  <button className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
                    <Forward className="w-4 h-4" />
                    Forward
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
              <Mail className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-lg font-medium">No message selected</p>
              <p className="text-sm">Select a message to view its contents</p>
            </div>
          )}
        </div>
      </div>

      {/* Compose Modal */}
      <Dialog open={showComposeModal} onOpenChange={setShowComposeModal}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Compose Message</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {/* Message Type */}
            <div className="flex gap-2">
              {(['email', 'sms', 'whatsapp'] as MessageType[]).map((type) => (
                <button
                  key={type}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors capitalize',
                    'border-slate-200 dark:border-slate-700 hover:border-teal-500'
                  )}
                >
                  <span className={cn('p-1 rounded', TYPE_COLORS[type])}>
                    {TYPE_ICONS[type]}
                  </span>
                  {type}
                </button>
              ))}
            </div>

            {/* To */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">To</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search contacts or enter email/phone"
                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Subject</label>
              <input
                type="text"
                placeholder="Enter subject"
                className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Message</label>
              <textarea
                rows={6}
                placeholder="Type your message..."
                className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
              <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                <Paperclip className="w-5 h-5 text-slate-400" />
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowComposeModal(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    toast.success('Message sent');
                    setShowComposeModal(false);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white rounded-lg transition-colors"
                >
                  <Send className="w-4 h-4" />
                  Send
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
