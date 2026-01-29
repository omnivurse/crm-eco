'use client';

import Link from 'next/link';
import { CalendarDays, ArrowRight, Clock, MapPin } from 'lucide-react';
import { WidgetCard } from '../WidgetCard';
import { EmptyState } from './shared';
import type { WidgetSize } from '@/lib/dashboard/types';

interface CalendarEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  location?: string;
  type: 'meeting' | 'call' | 'task' | 'reminder';
}

interface CalendarEventsWidgetProps {
  data: CalendarEvent[] | null;
  size: WidgetSize;
}

const sizeToDisplayCount: Record<WidgetSize, number> = {
  small: 3,
  medium: 5,
  large: 7,
  full: 10,
};

const eventTypeColors: Record<CalendarEvent['type'], string> = {
  meeting: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
  call: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400',
  task: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
  reminder: 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400',
};

const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }
  if (date.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow';
  }
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

export default function CalendarEventsWidget({
  data: events,
  size,
}: CalendarEventsWidgetProps) {
  const calendarEvents = events || [];
  const displayCount = sizeToDisplayCount[size] || 5;

  return (
    <WidgetCard
      title="Calendar Events"
      subtitle="Upcoming schedule"
      icon={<CalendarDays className="w-5 h-5 text-white" />}
      gradient="bg-gradient-to-r from-pink-500 via-rose-400 to-pink-500"
      badge={
        calendarEvents.length > 0
          ? `${calendarEvents.length} event${calendarEvents.length !== 1 ? 's' : ''}`
          : undefined
      }
      badgeColor="bg-pink-100 dark:bg-pink-500/20 text-pink-700 dark:text-pink-400"
      footer={
        calendarEvents.length > displayCount ? (
          <Link
            href="/crm/calendar"
            className="inline-flex items-center gap-1 text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium"
          >
            View calendar
            <ArrowRight className="w-4 h-4" />
          </Link>
        ) : undefined
      }
    >
      {calendarEvents.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="w-8 h-8 text-pink-600 dark:text-pink-400" />}
          title="No upcoming events"
          subtitle="Your calendar events will appear here"
        />
      ) : (
        <div className="space-y-2">
          {calendarEvents.slice(0, displayCount).map((event) => (
            <div
              key={event.id}
              className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {event.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
                    <Clock className="w-3 h-3 flex-shrink-0" />
                    <span suppressHydrationWarning>
                      {formatDate(event.start_time)} · {formatTime(event.start_time)}
                    </span>
                  </div>
                  {event.location && (
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{event.location}</span>
                    </div>
                  )}
                </div>
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0 ${
                    eventTypeColors[event.type]
                  }`}
                >
                  {event.type}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
