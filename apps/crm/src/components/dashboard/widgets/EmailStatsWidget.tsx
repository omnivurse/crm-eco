'use client';

import Link from 'next/link';
import { Mail, ArrowRight, Send, Eye, Reply, MousePointer } from 'lucide-react';
import { WidgetCard } from '../WidgetCard';
import { EmptyState } from './shared';
import type { WidgetSize } from '@/lib/dashboard/types';

interface EmailStatsData {
  sent: number;
  opened: number;
  replied: number;
  clicked: number;
  openRate: number;
  replyRate: number;
  clickRate: number;
  period: string;
}

interface EmailStatsWidgetProps {
  data: EmailStatsData | null;
  size: WidgetSize;
}

export default function EmailStatsWidget({
  data,
  size,
}: EmailStatsWidgetProps) {
  const stats = data || {
    sent: 0,
    opened: 0,
    replied: 0,
    clicked: 0,
    openRate: 0,
    replyRate: 0,
    clickRate: 0,
    period: 'Last 30 days',
  };

  const hasData = stats.sent > 0;

  const metrics = [
    {
      label: 'Sent',
      value: stats.sent,
      icon: Send,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-500/20',
    },
    {
      label: 'Opened',
      value: stats.opened,
      rate: stats.openRate,
      icon: Eye,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-500/20',
    },
    {
      label: 'Replied',
      value: stats.replied,
      rate: stats.replyRate,
      icon: Reply,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-100 dark:bg-purple-500/20',
    },
    {
      label: 'Clicked',
      value: stats.clicked,
      rate: stats.clickRate,
      icon: MousePointer,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-100 dark:bg-amber-500/20',
    },
  ];

  return (
    <WidgetCard
      title="Email Stats"
      subtitle={stats.period}
      icon={<Mail className="w-5 h-5 text-white" />}
      gradient="bg-gradient-to-r from-indigo-500 via-blue-400 to-indigo-500"
      footer={
        hasData ? (
          <Link
            href="/crm/inbox"
            className="inline-flex items-center gap-1 text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium"
          >
            View inbox
            <ArrowRight className="w-4 h-4" />
          </Link>
        ) : undefined
      }
    >
      {!hasData ? (
        <EmptyState
          icon={<Mail className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />}
          title="No email data"
          subtitle="Send emails to see your stats"
        />
      ) : (
        <div className={`grid ${size === 'small' ? 'grid-cols-2' : 'grid-cols-4'} gap-3`}>
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <div
                key={metric.label}
                className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-center"
              >
                <div className={`inline-flex p-2 rounded-lg ${metric.bgColor} mb-2`}>
                  <Icon className={`w-4 h-4 ${metric.color}`} />
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {metric.value.toLocaleString()}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {metric.label}
                </p>
                {metric.rate !== undefined && (
                  <p className={`text-xs font-medium mt-1 ${metric.color}`}>
                    {metric.rate.toFixed(1)}%
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </WidgetCard>
  );
}
