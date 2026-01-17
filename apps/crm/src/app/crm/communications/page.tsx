'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  Mail,
  Phone,
  Video,
  Calendar,
  Send,
  Inbox,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Search,
  Filter,
  Users,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';

// ============================================================================
// Type Definitions
// ============================================================================

interface CommunicationChannel {
  key: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  color: string;
  stats: {
    sent: number;
    received: number;
    pending: number;
  };
  status: 'connected' | 'not_configured' | 'error';
}

interface RecentActivity {
  id: string;
  type: 'email' | 'call' | 'sms' | 'meeting';
  subject: string;
  contact: string;
  time: string;
  status: 'sent' | 'received' | 'missed' | 'scheduled';
}

// ============================================================================
// Mock Data (Replace with API calls)
// ============================================================================

const CHANNELS: CommunicationChannel[] = [
  {
    key: 'email',
    name: 'Email',
    description: 'Send and track emails to contacts',
    icon: <Mail className="w-5 h-5" />,
    href: '/crm/integrations/email',
    color: 'blue',
    stats: { sent: 156, received: 89, pending: 12 },
    status: 'connected',
  },
  {
    key: 'calls',
    name: 'Calls',
    description: 'Make and log phone calls',
    icon: <Phone className="w-5 h-5" />,
    href: '/crm/integrations/phone',
    color: 'green',
    stats: { sent: 45, received: 32, pending: 5 },
    status: 'connected',
  },
  {
    key: 'sms',
    name: 'SMS',
    description: 'Send text messages to contacts',
    icon: <MessageSquare className="w-5 h-5" />,
    href: '/crm/integrations/phone',
    color: 'purple',
    stats: { sent: 78, received: 45, pending: 3 },
    status: 'not_configured',
  },
  {
    key: 'meetings',
    name: 'Meetings',
    description: 'Schedule and manage meetings',
    icon: <Video className="w-5 h-5" />,
    href: '/crm/scheduling',
    color: 'orange',
    stats: { sent: 23, received: 18, pending: 8 },
    status: 'connected',
  },
];

const RECENT_ACTIVITIES: RecentActivity[] = [
  { id: '1', type: 'email', subject: 'Follow-up on proposal', contact: 'John Smith', time: '10 min ago', status: 'sent' },
  { id: '2', type: 'call', subject: 'Discovery call', contact: 'Sarah Johnson', time: '1 hour ago', status: 'received' },
  { id: '3', type: 'meeting', subject: 'Product demo', contact: 'Mike Wilson', time: '2 hours ago', status: 'scheduled' },
  { id: '4', type: 'email', subject: 'Contract review', contact: 'Emily Davis', time: '3 hours ago', status: 'received' },
  { id: '5', type: 'sms', subject: 'Appointment reminder', contact: 'Chris Brown', time: '5 hours ago', status: 'sent' },
];

// ============================================================================
// Components
// ============================================================================

function StatCard({ label, value, trend, color }: { label: string; value: number; trend?: number; color: string }) {
  const colorClasses: Record<string, string> = {
    teal: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    green: 'bg-green-500/10 text-green-600 dark:text-green-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  };

  return (
    <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
        {trend !== undefined && (
          <span className={`text-xs font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <div className="text-3xl font-bold text-slate-900 dark:text-white">{value.toLocaleString()}</div>
    </div>
  );
}

function ChannelCard({ channel }: { channel: CommunicationChannel }) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    green: 'bg-green-500/10 text-green-600 dark:text-green-400',
    purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    orange: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  };

  const statusClasses: Record<string, { bg: string; text: string; label: string }> = {
    connected: { bg: 'bg-green-100 dark:bg-green-500/20', text: 'text-green-700 dark:text-green-400', label: 'Connected' },
    not_configured: { bg: 'bg-slate-100 dark:bg-slate-500/20', text: 'text-slate-600 dark:text-slate-400', label: 'Not Configured' },
    error: { bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-400', label: 'Error' },
  };

  const status = statusClasses[channel.status];

  return (
    <Link
      href={channel.href}
      className="group glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-5 hover:border-teal-500/50 transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-lg ${colorClasses[channel.color]}`}>
          {channel.icon}
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${status.bg} ${status.text}`}>
          {status.label}
        </span>
      </div>

      <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
        {channel.name}
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        {channel.description}
      </p>

      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
        <div className="text-center">
          <div className="text-lg font-semibold text-slate-900 dark:text-white">{channel.stats.sent}</div>
          <div className="text-xs text-slate-500">Sent</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-slate-900 dark:text-white">{channel.stats.received}</div>
          <div className="text-xs text-slate-500">Received</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-amber-600 dark:text-amber-400">{channel.stats.pending}</div>
          <div className="text-xs text-slate-500">Pending</div>
        </div>
      </div>
    </Link>
  );
}

function ActivityIcon({ type }: { type: RecentActivity['type'] }) {
  const icons = {
    email: <Mail className="w-4 h-4" />,
    call: <Phone className="w-4 h-4" />,
    sms: <MessageSquare className="w-4 h-4" />,
    meeting: <Video className="w-4 h-4" />,
  };
  return icons[type];
}

function ActivityRow({ activity }: { activity: RecentActivity }) {
  const statusColors = {
    sent: 'text-blue-600 dark:text-blue-400',
    received: 'text-green-600 dark:text-green-400',
    missed: 'text-red-600 dark:text-red-400',
    scheduled: 'text-amber-600 dark:text-amber-400',
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
      <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
        <ActivityIcon type={activity.type} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
          {activity.subject}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {activity.contact} &bull; {activity.time}
        </div>
      </div>
      <span className={`text-xs font-medium capitalize ${statusColors[activity.status]}`}>
        {activity.status}
      </span>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function CommunicationsPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return <CommunicationsSkeleton />;
  }

  const totalSent = CHANNELS.reduce((sum, c) => sum + c.stats.sent, 0);
  const totalReceived = CHANNELS.reduce((sum, c) => sum + c.stats.received, 0);
  const totalPending = CHANNELS.reduce((sum, c) => sum + c.stats.pending, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-violet-500/20 to-purple-500/20 rounded-xl">
            <MessageSquare className="w-6 h-6 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Communications Hub
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Manage all your customer communications in one place
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm">
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </Button>
          <Link href="/crm/communications/new">
            <Button className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400">
              <Plus className="w-4 h-4 mr-2" />
              New Message
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Sent (7d)" value={totalSent} trend={12} color="blue" />
        <StatCard label="Total Received (7d)" value={totalReceived} trend={8} color="green" />
        <StatCard label="Pending" value={totalPending} color="amber" />
        <StatCard label="Response Rate" value={78} trend={5} color="teal" />
      </div>

      {/* Channels Grid */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Communication Channels
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {CHANNELS.map((channel) => (
            <ChannelCard key={channel.key} channel={channel} />
          ))}
        </div>
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 dark:text-white">Recent Activity</h3>
            <Link href="/crm/activities" className="text-sm text-teal-600 dark:text-teal-400 hover:underline">
              View All
            </Link>
          </div>

          <div className="space-y-1">
            {RECENT_ACTIVITIES.map((activity) => (
              <ActivityRow key={activity.id} activity={activity} />
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Quick Actions</h3>

          <div className="space-y-2">
            <Link
              href="/crm/communications/new?type=email"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-900 dark:text-white">Send Email</div>
                <div className="text-xs text-slate-500">Compose a new email</div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </Link>

            <Link
              href="/crm/activities?type=calls"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <Phone className="w-5 h-5 text-green-600 dark:text-green-400" />
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-900 dark:text-white">Log a Call</div>
                <div className="text-xs text-slate-500">Record call notes</div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </Link>

            <Link
              href="/crm/scheduling/new"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <Calendar className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-900 dark:text-white">Schedule Meeting</div>
                <div className="text-xs text-slate-500">Book a meeting</div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </Link>

            <Link
              href="/crm/integrations"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <TrendingUp className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-900 dark:text-white">Connect Channels</div>
                <div className="text-xs text-slate-500">Set up integrations</div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function CommunicationsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-slate-200 dark:bg-slate-800/50 rounded-xl" />
        <div>
          <div className="h-7 w-48 bg-slate-200 dark:bg-slate-800/50 rounded" />
          <div className="h-4 w-64 bg-slate-200 dark:bg-slate-800/50 rounded mt-2" />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-slate-200 dark:bg-slate-800/50 rounded-xl" />
        ))}
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-48 bg-slate-200 dark:bg-slate-800/50 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
