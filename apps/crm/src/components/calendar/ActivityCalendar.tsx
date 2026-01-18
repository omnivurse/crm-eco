'use client';

import { useState, useMemo } from 'react';
import { cn } from '@crm-eco/ui/lib/utils';
import { Button } from '@crm-eco/ui/components/button';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Phone,
  Mail,
  CheckSquare,
  Calendar as CalendarIcon,
  Users,
} from 'lucide-react';

export interface CalendarEvent {
  id: string;
  title: string;
  type: 'task' | 'call' | 'meeting' | 'email';
  start: Date;
  end?: Date;
  allDay?: boolean;
  completed?: boolean;
  recordId?: string;
  recordTitle?: string;
  assignee?: {
    id: string;
    name: string;
    avatar?: string;
  };
}

interface ActivityCalendarProps {
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  onDateClick?: (date: Date) => void;
  onAddEvent?: (date: Date) => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const EVENT_COLORS = {
  task: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 border-blue-200 dark:border-blue-500/30',
  call: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400 border-green-200 dark:border-green-500/30',
  meeting: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400 border-violet-200 dark:border-violet-500/30',
  email: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border-amber-200 dark:border-amber-500/30',
};

const EVENT_ICONS = {
  task: <CheckSquare className="w-3 h-3" />,
  call: <Phone className="w-3 h-3" />,
  meeting: <Users className="w-3 h-3" />,
  email: <Mail className="w-3 h-3" />,
};

type ViewMode = 'month' | 'week' | 'day';

export function ActivityCalendar({
  events,
  onEventClick,
  onDateClick,
  onAddEvent,
}: ActivityCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Get calendar grid for month view
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days: Date[] = [];
    const current = new Date(startDate);

    // Generate 42 days (6 weeks)
    for (let i = 0; i < 42; i++) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return days;
  }, [currentDate]);

  // Get week days for week view
  const weekDays = useMemo(() => {
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay());

    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      days.push(new Date(start));
      start.setDate(start.getDate() + 1);
    }
    return days;
  }, [currentDate]);

  // Get events for a specific day
  const getEventsForDay = (date: Date) => {
    return events.filter(event => {
      const eventDate = new Date(event.start);
      return (
        eventDate.getFullYear() === date.getFullYear() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getDate() === date.getDate()
      );
    });
  };

  // Navigation
  const goToPrevious = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setDate(newDate.getDate() - 1);
    }
    setCurrentDate(newDate);
  };

  const goToNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    onDateClick?.(date);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {viewMode === 'day'
              ? currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
              : viewMode === 'week'
                ? `Week of ${weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                : `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`
            }
          </h2>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={goToPrevious}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={goToToday}>
              Today
            </Button>
            <Button variant="ghost" size="icon" onClick={goToNext}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            {(['month', 'week', 'day'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  viewMode === mode
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                )}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          {onAddEvent && (
            <Button onClick={() => onAddEvent(selectedDate || new Date())}>
              <Plus className="w-4 h-4 mr-2" />
              Add Activity
            </Button>
          )}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto">
        {viewMode === 'month' && (
          <div className="h-full flex flex-col">
            {/* Day Headers */}
            <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700">
              {DAYS.map((day) => (
                <div
                  key={day}
                  className="px-2 py-3 text-center text-sm font-medium text-slate-500 dark:text-slate-400"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="flex-1 grid grid-cols-7 grid-rows-6">
              {calendarDays.map((date, index) => {
                const dayEvents = getEventsForDay(date);
                const isSelected = selectedDate &&
                  date.getFullYear() === selectedDate.getFullYear() &&
                  date.getMonth() === selectedDate.getMonth() &&
                  date.getDate() === selectedDate.getDate();

                return (
                  <div
                    key={index}
                    onClick={() => handleDateClick(date)}
                    className={cn(
                      'min-h-[100px] border-b border-r border-slate-200 dark:border-slate-700 p-1 cursor-pointer transition-colors',
                      !isCurrentMonth(date) && 'bg-slate-50 dark:bg-slate-900/50',
                      isSelected && 'bg-violet-50 dark:bg-violet-500/10',
                      'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    )}
                  >
                    <div className={cn(
                      'w-7 h-7 flex items-center justify-center rounded-full text-sm mb-1',
                      isToday(date) && 'bg-violet-500 text-white',
                      !isToday(date) && !isCurrentMonth(date) && 'text-slate-400',
                      !isToday(date) && isCurrentMonth(date) && 'text-slate-900 dark:text-white'
                    )}>
                      {date.getDate()}
                    </div>

                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((event) => (
                        <button
                          key={event.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventClick?.(event);
                          }}
                          className={cn(
                            'w-full text-left px-1.5 py-0.5 rounded text-xs truncate border flex items-center gap-1',
                            EVENT_COLORS[event.type],
                            event.completed && 'line-through opacity-60'
                          )}
                        >
                          {EVENT_ICONS[event.type]}
                          <span className="truncate">{event.title}</span>
                        </button>
                      ))}
                      {dayEvents.length > 3 && (
                        <span className="text-xs text-slate-500 pl-1">
                          +{dayEvents.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {viewMode === 'week' && (
          <div className="h-full flex flex-col">
            {/* Day Headers */}
            <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700">
              {weekDays.map((date, index) => (
                <div
                  key={index}
                  className={cn(
                    'px-2 py-3 text-center',
                    isToday(date) && 'bg-violet-50 dark:bg-violet-500/10'
                  )}
                >
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    {DAYS[date.getDay()]}
                  </p>
                  <p className={cn(
                    'text-2xl font-semibold mt-1',
                    isToday(date) ? 'text-violet-600 dark:text-violet-400' : 'text-slate-900 dark:text-white'
                  )}>
                    {date.getDate()}
                  </p>
                </div>
              ))}
            </div>

            {/* Events Grid */}
            <div className="flex-1 grid grid-cols-7 divide-x divide-slate-200 dark:divide-slate-700">
              {weekDays.map((date, index) => {
                const dayEvents = getEventsForDay(date);

                return (
                  <div
                    key={index}
                    className={cn(
                      'p-2 space-y-2 overflow-y-auto',
                      isToday(date) && 'bg-violet-50/50 dark:bg-violet-500/5'
                    )}
                  >
                    {dayEvents.map((event) => (
                      <button
                        key={event.id}
                        onClick={() => onEventClick?.(event)}
                        className={cn(
                          'w-full text-left p-2 rounded-lg border transition-colors',
                          EVENT_COLORS[event.type],
                          'hover:opacity-80'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {EVENT_ICONS[event.type]}
                          <span className="text-sm font-medium truncate">
                            {event.title}
                          </span>
                        </div>
                        {!event.allDay && (
                          <p className="text-xs mt-1 opacity-75">
                            {event.start.toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </p>
                        )}
                        {event.recordTitle && (
                          <p className="text-xs mt-1 truncate opacity-75">
                            {event.recordTitle}
                          </p>
                        )}
                      </button>
                    ))}

                    {dayEvents.length === 0 && (
                      <button
                        onClick={() => onAddEvent?.(date)}
                        className="w-full h-16 flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg text-slate-400 hover:border-slate-300 hover:text-slate-500 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {viewMode === 'day' && (
          <div className="h-full p-4">
            <div className="space-y-3">
              {getEventsForDay(currentDate).map((event) => (
                <button
                  key={event.id}
                  onClick={() => onEventClick?.(event)}
                  className={cn(
                    'w-full text-left p-4 rounded-xl border transition-colors',
                    EVENT_COLORS[event.type],
                    'hover:opacity-80'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white/50 dark:bg-black/20">
                      {EVENT_ICONS[event.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{event.title}</p>
                      {!event.allDay && (
                        <p className="text-sm mt-0.5 opacity-75">
                          {event.start.toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                          {event.end && ` - ${event.end.toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}`}
                        </p>
                      )}
                    </div>
                    {event.assignee && (
                      <span className="text-sm">{event.assignee.name}</span>
                    )}
                  </div>
                  {event.recordTitle && (
                    <p className="text-sm mt-2 opacity-75">
                      Related to: {event.recordTitle}
                    </p>
                  )}
                </button>
              ))}

              {getEventsForDay(currentDate).length === 0 && (
                <div className="text-center py-12">
                  <CalendarIcon className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                  <p className="text-slate-500 dark:text-slate-400 mb-4">
                    No activities scheduled for this day
                  </p>
                  {onAddEvent && (
                    <Button onClick={() => onAddEvent(currentDate)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Activity
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
