'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mail,
  MessageSquare,
  MessageCircle,
  Phone,
  Video,
  Headphones,
  Radio,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';

interface ChannelInfo {
  key: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  activeColor: string;
  href: string;
}

const CHANNELS: ChannelInfo[] = [
  {
    key: 'email',
    label: 'Email',
    icon: <Mail className="w-5 h-5" />,
    color: 'text-blue-500',
    activeColor: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30',
    href: '/crm/inbox?channel=email',
  },
  {
    key: 'sms',
    label: 'SMS',
    icon: <MessageSquare className="w-5 h-5" />,
    color: 'text-green-500',
    activeColor: 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30',
    href: '/crm/inbox?channel=sms',
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    icon: <MessageCircle className="w-5 h-5" />,
    color: 'text-emerald-500',
    activeColor: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30',
    href: '/crm/inbox?channel=whatsapp',
  },
  {
    key: 'phone',
    label: 'Phone',
    icon: <Phone className="w-5 h-5" />,
    color: 'text-orange-500',
    activeColor: 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/30',
    href: '/crm/inbox?channel=phone',
  },
  {
    key: 'video',
    label: 'Video',
    icon: <Video className="w-5 h-5" />,
    color: 'text-purple-500',
    activeColor: 'bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/30',
    href: '/crm/inbox?channel=video',
  },
  {
    key: 'chat',
    label: 'Live Chat',
    icon: <Headphones className="w-5 h-5" />,
    color: 'text-teal-500',
    activeColor: 'bg-teal-50 dark:bg-teal-500/10 border-teal-200 dark:border-teal-500/30',
    href: '/crm/inbox?channel=chat',
  },
];

interface ChannelsPanelProps {
  onClose: () => void;
}

export function ChannelsPanel({ onClose }: ChannelsPanelProps) {
  const [stats, setStats] = useState<Record<string, { total: number; unread: number }>>({});
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/inbox?stats=true');
      if (res.ok) {
        const data = await res.json();
        if (data.byChannel) {
          setStats(data.byChannel);
        } else if (data.channels) {
          setStats(data.channels);
        }
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-teal-500" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Channels</h3>
        </div>
        <button
          onClick={() => { router.push('/crm/inbox'); onClose(); }}
          className="flex items-center gap-1 text-[10px] font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700 transition-colors"
        >
          View All
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>

      {/* Channels Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="p-3 grid grid-cols-2 gap-2">
          {CHANNELS.map((ch) => {
            const channelStats = stats[ch.key];
            const unread = channelStats?.unread || 0;
            const total = channelStats?.total || 0;

            return (
              <button
                key={ch.key}
                onClick={() => { router.push(ch.href); onClose(); }}
                className={cn(
                  'flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all',
                  'hover:scale-[1.02] active:scale-[0.98]',
                  unread > 0
                    ? ch.activeColor
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                )}
              >
                <div className="relative">
                  <span className={ch.color}>{ch.icon}</span>
                  {unread > 0 && (
                    <span className="absolute -top-1 -right-2 w-4 h-4 flex items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">{ch.label}</span>
                {total > 0 && (
                  <span className="text-[9px] text-slate-400 dark:text-slate-500">
                    {total} conversation{total !== 1 ? 's' : ''}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
