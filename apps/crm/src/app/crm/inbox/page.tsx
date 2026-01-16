'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Inbox,
  Search,
  Filter,
  RefreshCw,
  Mail,
  MessageSquare,
  Phone,
  Video,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  MoreVertical,
  UserPlus,
  Archive,
  Trash2,
  Tag,
  Bell,
  Settings,
} from 'lucide-react';
import type {
  InboxConversation,
  InboxStats,
  ConversationStatus,
  InboxChannel,
  ConversationPriority,
} from '@/lib/inbox/types';
import {
  CHANNEL_CONFIG,
  PRIORITY_CONFIG,
  STATUS_CONFIG,
} from '@/lib/inbox/types';

// ============================================================================
// Types
// ============================================================================

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
  if (diffMinutes < 10080) return `${Math.floor(diffMinutes / 1440)}d ago`;
  return date.toLocaleDateString();
}

function getChannelIcon(channel: InboxChannel) {
  const iconMap: Record<InboxChannel, React.ReactNode> = {
    email: <Mail className="w-4 h-4" />,
    sms: <MessageSquare className="w-4 h-4" />,
    whatsapp: <MessageSquare className="w-4 h-4" />,
    phone: <Phone className="w-4 h-4" />,
    video: <Video className="w-4 h-4" />,
    chat: <MessageSquare className="w-4 h-4" />,
    social: <User className="w-4 h-4" />,
    support: <AlertCircle className="w-4 h-4" />,
  };
  return iconMap[channel] || <Mail className="w-4 h-4" />;
}

// ============================================================================
// Components
// ============================================================================

function StatsBar({ stats }: { stats: InboxStats | null }) {
  if (!stats) return null;
  
  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-500 dark:text-slate-400">Open:</span>
        <span className="font-medium text-slate-900 dark:text-white">{stats.total_open}</span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-500 dark:text-slate-400">Unread:</span>
        <span className="font-medium text-blue-600 dark:text-blue-400">{stats.total_unread}</span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-500 dark:text-slate-400">Mine:</span>
        <span className="font-medium text-slate-900 dark:text-white">{stats.assigned_to_me}</span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-500 dark:text-slate-400">Unassigned:</span>
        <span className="font-medium text-amber-600 dark:text-amber-400">{stats.unassigned}</span>
      </div>
    </div>
  );
}

function ConversationRow({
  conversation,
  isSelected,
  onClick,
  onAssign,
  teamMembers,
}: {
  conversation: InboxConversation;
  isSelected: boolean;
  onClick: () => void;
  onAssign: (userId: string | null) => void;
  teamMembers: TeamMember[];
}) {
  const [showActions, setShowActions] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  
  const channelConfig = CHANNEL_CONFIG[conversation.channel];
  const priorityConfig = PRIORITY_CONFIG[conversation.priority];
  const statusConfig = STATUS_CONFIG[conversation.status];
  
  return (
    <div
      className={`group flex items-start gap-3 p-4 border-b border-slate-200 dark:border-slate-700 cursor-pointer transition-colors ${
        isSelected 
          ? 'bg-teal-50 dark:bg-teal-900/20 border-l-2 border-l-teal-500'
          : conversation.unread_count > 0
            ? 'bg-blue-50/50 dark:bg-blue-900/10 hover:bg-slate-50 dark:hover:bg-slate-800/50'
            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
      }`}
      onClick={onClick}
    >
      {/* Channel Icon */}
      <div className={`p-2 rounded-lg bg-${channelConfig.color}-500/10`}>
        <div className={`text-${channelConfig.color}-600 dark:text-${channelConfig.color}-400`}>
          {getChannelIcon(conversation.channel)}
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`font-medium truncate ${
            conversation.unread_count > 0 
              ? 'text-slate-900 dark:text-white' 
              : 'text-slate-700 dark:text-slate-300'
          }`}>
            {conversation.contact_name || conversation.contact_email || conversation.contact_phone || 'Unknown'}
          </span>
          {conversation.unread_count > 0 && (
            <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-500 text-white rounded-full">
              {conversation.unread_count}
            </span>
          )}
          {conversation.priority !== 'normal' && (
            <span className={`px-1.5 py-0.5 text-xs font-medium rounded bg-${priorityConfig.color}-100 dark:bg-${priorityConfig.color}-500/20 text-${priorityConfig.color}-700 dark:text-${priorityConfig.color}-400`}>
              {priorityConfig.name}
            </span>
          )}
        </div>
        
        <div className={`text-sm truncate ${
          conversation.unread_count > 0 
            ? 'text-slate-700 dark:text-slate-300' 
            : 'text-slate-500 dark:text-slate-400'
        }`}>
          {conversation.subject && <span className="font-medium">{conversation.subject} - </span>}
          {conversation.preview || 'No preview available'}
        </div>
        
        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
          <span className={`px-1.5 py-0.5 rounded bg-${statusConfig.color}-100 dark:bg-${statusConfig.color}-500/20 text-${statusConfig.color}-700 dark:text-${statusConfig.color}-400`}>
            {statusConfig.name}
          </span>
          <span>•</span>
          <span>{formatTimeAgo(conversation.last_message_at)}</span>
          {conversation.assigned_to && (
            <>
              <span>•</span>
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                Assigned
              </span>
            </>
          )}
        </div>
      </div>
      
      {/* Actions */}
      <div className="relative flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); setShowAssign(!showAssign); }}
          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
          title="Assign"
        >
          <UserPlus className="w-4 h-4 text-slate-500" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setShowActions(!showActions); }}
          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
        >
          <MoreVertical className="w-4 h-4 text-slate-500" />
        </button>
        
        {/* Assign Dropdown */}
        {showAssign && (
          <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 z-10">
            <div className="p-2 border-b border-slate-200 dark:border-slate-700">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                Assign to
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto">
              <button
                onClick={(e) => { e.stopPropagation(); onAssign(null); setShowAssign(false); }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
              >
                Unassigned
              </button>
              {teamMembers.map((member) => (
                <button
                  key={member.id}
                  onClick={(e) => { e.stopPropagation(); onAssign(member.id); setShowAssign(false); }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                >
                  {member.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      
      <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-12">
      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
        <Inbox className="w-8 h-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
        No conversations yet
      </h3>
      <p className="text-slate-500 dark:text-slate-400 text-center max-w-sm">
        Incoming messages from email, SMS, WhatsApp, and other channels will appear here
      </p>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function InboxPage() {
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [stats, setStats] = useState<InboxStats | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | ''>('');
  const [channelFilter, setChannelFilter] = useState<InboxChannel | ''>('');
  const [assignedFilter, setAssignedFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ include_stats: 'true' });
      
      if (statusFilter) params.set('status', statusFilter);
      if (channelFilter) params.set('channel', channelFilter);
      if (assignedFilter) params.set('assigned_to', assignedFilter);
      if (searchQuery) params.set('search', searchQuery);
      
      const response = await fetch(`/api/inbox?${params}`);
      const data = await response.json();
      
      setConversations(data.conversations || []);
      setStats(data.stats || null);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, channelFilter, assignedFilter, searchQuery]);

  const fetchTeamMembers = useCallback(async () => {
    try {
      const response = await fetch('/api/inbox/team');
      const data = await response.json();
      setTeamMembers(data.members || []);
    } catch (error) {
      console.error('Failed to fetch team members:', error);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
    fetchTeamMembers();
  }, [fetchConversations, fetchTeamMembers]);

  const handleAssign = async (conversationId: string, userId: string | null) => {
    try {
      await fetch(`/api/inbox/${conversationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'assign', assigned_to: userId }),
      });
      fetchConversations();
    } catch (error) {
      console.error('Failed to assign:', error);
    }
  };

  const selectedConversation = conversations.find(c => c.id === selectedId);

  return (
    <div className="h-[calc(100vh-10rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-teal-500/20 to-cyan-500/20 rounded-xl">
            <Inbox className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Inbox</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Unified omnichannel communications
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchConversations()}
            disabled={loading}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-5 h-5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/crm/settings/comms"
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Settings className="w-5 h-5 text-slate-500" />
          </Link>
        </div>
      </div>
      
      {/* Stats Bar */}
      <StatsBar stats={stats} />
      
      {/* Filters */}
      <div className="flex items-center gap-3 p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400"
          />
        </div>
        
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ConversationStatus | '')}
          className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
        >
          <option value="">All Status</option>
          <option value="open">Open</option>
          <option value="pending">Pending</option>
          <option value="snoozed">Snoozed</option>
          <option value="resolved">Resolved</option>
        </select>
        
        <select
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value as InboxChannel | '')}
          className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
        >
          <option value="">All Channels</option>
          <option value="email">Email</option>
          <option value="sms">SMS</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="phone">Phone</option>
          <option value="chat">Chat</option>
        </select>
        
        <select
          value={assignedFilter}
          onChange={(e) => setAssignedFilter(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
        >
          <option value="">All Assignments</option>
          <option value="unassigned">Unassigned</option>
          {teamMembers.map((member) => (
            <option key={member.id} value={member.id}>{member.name}</option>
          ))}
        </select>
        
        <button
          onClick={() => {
            setStatusFilter('');
            setChannelFilter('');
            setAssignedFilter('');
            setSearchQuery('');
          }}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
        >
          <Filter className="w-4 h-4" />
          Clear
        </button>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Conversation List */}
        <div className={`${selectedId ? 'w-1/3 border-r border-slate-200 dark:border-slate-700' : 'w-full'} overflow-y-auto`}>
          {loading && conversations.length === 0 ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="animate-pulse flex items-start gap-3">
                  <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/3 bg-slate-200 dark:bg-slate-700 rounded" />
                    <div className="h-3 w-2/3 bg-slate-200 dark:bg-slate-700 rounded" />
                    <div className="h-3 w-1/4 bg-slate-200 dark:bg-slate-700 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <EmptyState />
          ) : (
            conversations.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                isSelected={conversation.id === selectedId}
                onClick={() => setSelectedId(conversation.id)}
                onAssign={(userId) => handleAssign(conversation.id, userId)}
                teamMembers={teamMembers}
              />
            ))
          )}
        </div>
        
        {/* Conversation Detail */}
        {selectedId && selectedConversation && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-slate-900 dark:text-white">
                    {selectedConversation.contact_name || selectedConversation.contact_email || 'Unknown'}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {selectedConversation.subject || `${CHANNEL_CONFIG[selectedConversation.channel].name} conversation`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      fetch(`/api/inbox/${selectedId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'resolve' }),
                      }).then(() => fetchConversations());
                    }}
                    className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <CheckCircle2 className="w-4 h-4 inline mr-1" />
                    Resolve
                  </button>
                  <button
                    onClick={() => {
                      fetch(`/api/inbox/${selectedId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'archive' }),
                      }).then(() => { setSelectedId(null); fetchConversations(); });
                    }}
                    className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                  >
                    <Archive className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setSelectedId(null)}
                    className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Select a conversation to view messages</p>
                <Link
                  href={`/crm/inbox/${selectedId}`}
                  className="inline-flex items-center gap-1 mt-3 text-teal-600 dark:text-teal-400 hover:underline"
                >
                  Open full view <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
