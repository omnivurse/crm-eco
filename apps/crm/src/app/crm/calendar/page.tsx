'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import {
    ChevronLeft,
    ChevronRight,
    Plus,
    Calendar as CalendarIcon,
    Clock,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Video,
    MapPin,
    Users,
    Link2,
    Settings,
    RefreshCcw,
    X,
    Check,
} from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@crm-eco/ui/components/dialog';

// Calendar provider types
type CalendarProvider = 'google' | 'outlook' | 'personal';

interface CalendarEvent {
    id: string;
    title: string;
    description?: string;
    start: Date;
    end: Date;
    allDay?: boolean;
    location?: string;
    attendees?: string[];
    provider: CalendarProvider;
    color?: string;
    status?: 'confirmed' | 'tentative' | 'cancelled';
}

interface Task {
    id: string;
    title: string;
    due_at: string;
    priority: string;
    status: string;
}

interface CrmTask {
    id: string;
    title: string;
    description: string | null;
    due_at: string | null;
    activity_type: string;
    meeting_location: string | null;
    meeting_type: string | null;
    status: string;
    assigned_to: string | null;
    record?: {
        id: string;
        title: string;
    }[] | null;
}

interface ConnectedCalendar {
    id: string;
    provider: CalendarProvider;
    email: string;
    name: string;
    color: string;
    enabled: boolean;
}

const PROVIDER_COLORS: Record<CalendarProvider, string> = {
    google: '#4285F4',
    outlook: '#0078D4',
    personal: '#10B981',
};

const PROVIDER_NAMES: Record<CalendarProvider, string> = {
    google: 'Google Calendar',
    outlook: 'Outlook Calendar',
    personal: 'Personal Calendar',
};

export default function CalendarPage() {
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState<'month' | 'week' | 'day'>('month');
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [connectedCalendars, setConnectedCalendars] = useState<ConnectedCalendar[]>([]);
    const [showNewEventModal, setShowNewEventModal] = useState(false);
    const [showIntegrationModal, setShowIntegrationModal] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [newEventTitle, setNewEventTitle] = useState('');
    const [newEventStart, setNewEventStart] = useState('');
    const [newEventEnd, setNewEventEnd] = useState('');
    const [newEventLocation, setNewEventLocation] = useState('');
    const [newEventDescription, setNewEventDescription] = useState('');
    const [newEventType, setNewEventType] = useState<'meeting' | 'call' | 'task' | 'email'>('meeting');
    const [isCreatingEvent, setIsCreatingEvent] = useState(false);
    const [profileData, setProfileData] = useState<{ id: string; organization_id: string } | null>(null);
    const [showEventDetailModal, setShowEventDetailModal] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Load data
    useEffect(() => {
        async function loadData() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                // Get profile
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('id, organization_id')
                    .eq('user_id', user.id)
                    .single();

                if (profile) {
                    setProfileData({ id: profile.id, organization_id: profile.organization_id });
                    
                    // Load tasks (activity_type = 'task')
                    const { data: tasksData } = await supabase
                        .from('crm_tasks')
                        .select('id, title, due_at, priority, status')
                        .eq('org_id', profile.organization_id)
                        .eq('activity_type', 'task')
                        .neq('status', 'completed')
                        .order('due_at', { ascending: true })
                        .limit(10);

                    setTasks((tasksData || []) as Task[]);

                    // Load meetings and calls from crm_tasks
                    const { data: activitiesData } = await supabase
                        .from('crm_tasks')
                        .select(`
                            id,
                            title,
                            description,
                            due_at,
                            activity_type,
                            meeting_location,
                            meeting_type,
                            status,
                            assigned_to,
                            record:crm_records(id, title)
                        `)
                        .eq('org_id', profile.organization_id)
                        .in('activity_type', ['meeting', 'call'])
                        .neq('status', 'completed')
                        .not('due_at', 'is', null)
                        .order('due_at', { ascending: true });

                    // Convert activities to calendar events
                    const calendarEvents: CalendarEvent[] = ((activitiesData || []) as unknown as CrmTask[]).map(activity => {
                        const startDate = new Date(activity.due_at!);
                        const endDate = new Date(startDate.getTime() + (activity.activity_type === 'call' ? 1800000 : 3600000)); // 30min for calls, 1hr for meetings

                        return {
                            id: activity.id,
                            title: activity.title,
                            description: activity.description || undefined,
                            start: startDate,
                            end: endDate,
                            location: activity.meeting_location || undefined,
                            provider: 'personal' as CalendarProvider,
                            color: activity.activity_type === 'meeting' ? '#10B981' : '#8B5CF6', // green for meetings, purple for calls
                            status: activity.status === 'cancelled' ? 'cancelled' : 'confirmed',
                        };
                    });

                    setEvents(calendarEvents);

                    // Load connected calendars from integration_connections table
                    const { data: connections } = await supabase
                        .from('integration_connections')
                        .select('id, provider, external_account_email, external_account_name, status')
                        .eq('org_id', profile.organization_id)
                        .eq('connection_type', 'calendar')
                        .eq('status', 'connected');

                    if (connections) {
                        const calendars: ConnectedCalendar[] = connections.map(conn => ({
                            id: conn.id,
                            provider: conn.provider === 'google_calendar' ? 'google' : 'outlook' as CalendarProvider,
                            email: conn.external_account_email || '',
                            name: conn.provider === 'google_calendar' ? 'Google Calendar' : 'Outlook Calendar',
                            color: conn.provider === 'google_calendar' ? PROVIDER_COLORS.google : PROVIDER_COLORS.outlook,
                            enabled: true,
                        }));
                        setConnectedCalendars(calendars);

                        // Load synced calendar events
                        const { data: syncedEvents } = await supabase
                            .from('calendar_events')
                            .select('*')
                            .eq('owner_id', profile.id)
                            .neq('status', 'cancelled');

                        if (syncedEvents) {
                            const calEvents: CalendarEvent[] = syncedEvents.map(e => ({
                                id: e.id,
                                title: e.title,
                                description: e.description,
                                start: new Date(e.start_time),
                                end: new Date(e.end_time),
                                allDay: e.is_all_day,
                                location: e.location,
                                provider: e.provider === 'google_calendar' ? 'google' : 'outlook' as CalendarProvider,
                                color: e.provider === 'google_calendar' ? PROVIDER_COLORS.google : PROVIDER_COLORS.outlook,
                                status: e.status,
                            }));
                            // Merge with CRM task events
                            setEvents(prev => [...prev, ...calEvents]);
                        }
                    }
                }
            } catch (error) {
                console.error('Error loading calendar data:', error);
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, [supabase]);

    // Calendar navigation
    const goToPrevious = () => {
        const newDate = new Date(currentDate);
        if (view === 'month') newDate.setMonth(newDate.getMonth() - 1);
        else if (view === 'week') newDate.setDate(newDate.getDate() - 7);
        else newDate.setDate(newDate.getDate() - 1);
        setCurrentDate(newDate);
    };

    const goToNext = () => {
        const newDate = new Date(currentDate);
        if (view === 'month') newDate.setMonth(newDate.getMonth() + 1);
        else if (view === 'week') newDate.setDate(newDate.getDate() + 7);
        else newDate.setDate(newDate.getDate() + 1);
        setCurrentDate(newDate);
    };

    const goToToday = () => setCurrentDate(new Date());

    // Generate calendar days for month view
    const calendarDays = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Monday start

        const days: (Date | null)[] = [];

        // Previous month days
        for (let i = 0; i < startingDay; i++) {
            const prevDate = new Date(year, month, -startingDay + i + 1);
            days.push(prevDate);
        }

        // Current month days
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(new Date(year, month, i));
        }

        // Next month days to complete the grid
        const remaining = 42 - days.length;
        for (let i = 1; i <= remaining; i++) {
            days.push(new Date(year, month + 1, i));
        }

        return days;
    }, [currentDate]);

    // Get events for a specific date
    const getEventsForDate = (date: Date) => {
        return events.filter(event => {
            const eventDate = new Date(event.start);
            return eventDate.toDateString() === date.toDateString();
        });
    };

    // Check if date is today
    const isToday = (date: Date) => {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    };

    // Check if date is in current month
    const isCurrentMonth = (date: Date) => {
        return date.getMonth() === currentDate.getMonth();
    };

    // Connect calendar provider
    const connectCalendar = async (provider: CalendarProvider) => {
        if (provider === 'personal') {
            // Personal calendar doesn't need OAuth
            toast.success('Personal calendar events will show from CRM tasks');
            setShowIntegrationModal(false);
            return;
        }

        toast.info(`Connecting to ${PROVIDER_NAMES[provider]}...`);

        try {
            // Map provider to our internal provider ID
            const providerMap: Record<string, string> = {
                google: 'google_calendar',
                outlook: 'microsoft_outlook',
            };

            const response = await fetch('/api/calendar/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider: providerMap[provider] }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to connect');
            }

            const { authorizationUrl } = await response.json();

            // Redirect to OAuth provider
            window.location.href = authorizationUrl;
        } catch (error) {
            console.error('Calendar connect error:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to connect calendar');
        }
    };

    // Handle date click - open new event modal with date pre-selected
    const handleDateClick = (date: Date) => {
        setSelectedDate(date);
        // Pre-fill the start date/time
        const dateStr = date.toISOString().slice(0, 16);
        setNewEventStart(dateStr);
        // Set end time to 1 hour later
        const endDate = new Date(date.getTime() + 3600000);
        setNewEventEnd(endDate.toISOString().slice(0, 16));
        setShowNewEventModal(true);
    };

    // Handle event click - show event details
    const handleEventClick = (event: CalendarEvent, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setSelectedEvent(event);
        setShowEventDetailModal(true);
    };

    // Complete a task
    const completeTask = async (taskId: string) => {
        try {
            const { error } = await supabase
                .from('crm_tasks')
                .update({ status: 'completed', completed_at: new Date().toISOString() })
                .eq('id', taskId);

            if (error) throw error;

            // Remove from local tasks list
            setTasks(prev => prev.filter(t => t.id !== taskId));
            // Also remove from events if it was a meeting/call
            setEvents(prev => prev.filter(e => e.id !== taskId));
            toast.success('Task completed');
        } catch (error) {
            console.error('Error completing task:', error);
            toast.error('Failed to complete task');
        }
    };

    // Get priority badge color
    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'urgent': return 'bg-red-500';
            case 'high': return 'bg-orange-500';
            case 'normal': return 'bg-yellow-500';
            case 'low': return 'bg-slate-400';
            default: return 'bg-slate-400';
        }
    };

    // Today's events
    const todaysEvents = events.filter(e => isToday(new Date(e.start)));

    // Generate week days for week view
    const weekDays = useMemo(() => {
        const startOfWeek = new Date(currentDate);
        const day = startOfWeek.getDay();
        const diff = day === 0 ? -6 : 1 - day; // Monday start
        startOfWeek.setDate(startOfWeek.getDate() + diff);

        const days: Date[] = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            days.push(d);
        }
        return days;
    }, [currentDate]);

    // Hours for day/week view
    const hours = Array.from({ length: 24 }, (_, i) => i);

    // Get events for a specific hour on a specific date
    const getEventsForHour = (date: Date, hour: number) => {
        return events.filter(event => {
            const eventDate = new Date(event.start);
            return eventDate.toDateString() === date.toDateString() &&
                eventDate.getHours() === hour;
        });
    };

    // Format header based on view
    const formatHeader = () => {
        if (view === 'day') {
            return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        }
        if (view === 'week') {
            const start = weekDays[0];
            const end = weekDays[6];
            if (start.getMonth() === end.getMonth()) {
                return `${start.toLocaleDateString('en-US', { month: 'long' })} ${start.getDate()} - ${end.getDate()}, ${start.getFullYear()}`;
            }
            return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        }
        return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
            </div>
        );
    }

    return (
        <div className="max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Calendar</h1>
                    <p className="text-slate-500 dark:text-slate-400">Manage your schedule and appointments</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowIntegrationModal(true)}
                        className="inline-flex items-center gap-2 px-3 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <Settings className="w-4 h-4" />
                        <span className="hidden sm:inline">Integrations</span>
                    </button>
                    <button
                        onClick={() => setShowNewEventModal(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white rounded-lg transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        New Event
                    </button>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <button
                        onClick={goToPrevious}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                    </button>
                    <button
                        onClick={goToToday}
                        className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
                    >
                        Today
                    </button>
                    <button
                        onClick={goToNext}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                    </button>
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white ml-4">{formatHeader()}</h2>
                </div>

                {/* View Toggle */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    {(['month', 'week', 'day'] as const).map((v) => (
                        <button
                            key={v}
                            onClick={() => setView(v)}
                            className={cn(
                                'px-4 py-1.5 text-sm font-medium rounded-md transition-colors capitalize',
                                view === v
                                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            )}
                        >
                            {v}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex gap-6">
                {/* Calendar Grid */}
                <div className="flex-1 glass-card border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                    {/* Month View */}
                    {view === 'month' && (
                        <>
                            {/* Day Headers */}
                            <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700">
                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                                    <div
                                        key={day}
                                        className="py-3 text-center text-sm font-medium text-slate-600 dark:text-slate-400"
                                    >
                                        {day}
                                    </div>
                                ))}
                            </div>

                            {/* Calendar Days */}
                            <div className="grid grid-cols-7">
                                {calendarDays.map((date, index) => {
                                    if (!date) return <div key={index} className="h-28 border-b border-r border-slate-100 dark:border-slate-800" />;

                                    const dayEvents = getEventsForDate(date);
                                    const isCurrentMonthDay = isCurrentMonth(date);
                                    const isTodayDate = isToday(date);

                                    return (
                                        <div
                                            key={index}
                                            onClick={() => handleDateClick(date)}
                                            className={cn(
                                                'h-28 p-2 border-b border-r border-slate-100 dark:border-slate-800 cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50',
                                                !isCurrentMonthDay && 'bg-slate-50 dark:bg-slate-900/50',
                                                isTodayDate && 'bg-teal-50/50 dark:bg-teal-900/20',
                                                selectedDate?.toDateString() === date.toDateString() && 'ring-2 ring-teal-500 ring-inset'
                                            )}
                                        >
                                            <div className="flex items-center justify-center mb-1">
                                                <span
                                                    className={cn(
                                                        'w-7 h-7 flex items-center justify-center text-sm font-medium rounded-full',
                                                        isTodayDate && 'bg-teal-600 text-white',
                                                        !isTodayDate && isCurrentMonthDay && 'text-slate-900 dark:text-white',
                                                        !isTodayDate && !isCurrentMonthDay && 'text-slate-400 dark:text-slate-600'
                                                    )}
                                                >
                                                    {date.getDate()}
                                                </span>
                                            </div>
                                            <div className="space-y-1">
                                                {dayEvents.slice(0, 2).map((event) => (
                                                    <button
                                                        key={event.id}
                                                        onClick={(e) => handleEventClick(event, e)}
                                                        className="w-full text-left text-xs px-1.5 py-0.5 rounded truncate hover:opacity-80"
                                                        style={{ backgroundColor: `${event.color}20`, color: event.color }}
                                                    >
                                                        {event.title}
                                                    </button>
                                                ))}
                                                {dayEvents.length > 2 && (
                                                    <div className="text-xs text-slate-500 pl-1">+{dayEvents.length - 2} more</div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    {/* Week View */}
                    {view === 'week' && (
                        <>
                            {/* Day Headers with dates */}
                            <div className="grid grid-cols-8 border-b border-slate-200 dark:border-slate-700">
                                <div className="py-3 text-center text-sm font-medium text-slate-400 border-r border-slate-200 dark:border-slate-700 w-16" />
                                {weekDays.map((date, i) => (
                                    <div
                                        key={i}
                                        className={cn(
                                            'py-3 text-center border-r border-slate-200 dark:border-slate-700 last:border-r-0',
                                            isToday(date) && 'bg-teal-50/50 dark:bg-teal-900/20'
                                        )}
                                    >
                                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                            {date.toLocaleDateString('en-US', { weekday: 'short' })}
                                        </div>
                                        <div className={cn(
                                            'text-lg font-semibold mt-0.5',
                                            isToday(date) ? 'text-teal-600 dark:text-teal-400' : 'text-slate-900 dark:text-white'
                                        )}>
                                            {date.getDate()}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Time Grid */}
                            <div className="overflow-y-auto max-h-[600px]">
                                {hours.slice(6, 22).map((hour) => (
                                    <div key={hour} className="grid grid-cols-8 border-b border-slate-100 dark:border-slate-800">
                                        <div className="py-2 px-2 text-xs text-slate-400 text-right border-r border-slate-200 dark:border-slate-700 w-16">
                                            {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                                        </div>
                                        {weekDays.map((date, i) => {
                                            const hourEvents = getEventsForHour(date, hour);
                                            const slotDate = new Date(date);
                                            slotDate.setHours(hour, 0, 0, 0);
                                            return (
                                                <div
                                                    key={i}
                                                    onClick={() => handleDateClick(slotDate)}
                                                    className={cn(
                                                        'min-h-[48px] p-1 border-r border-slate-100 dark:border-slate-800 last:border-r-0 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors',
                                                        isToday(date) && 'bg-teal-50/30 dark:bg-teal-900/10'
                                                    )}
                                                >
                                                    {hourEvents.map((event) => (
                                                        <button
                                                            key={event.id}
                                                            onClick={(e) => handleEventClick(event, e)}
                                                            className="w-full text-left text-xs px-1.5 py-1 rounded mb-1 truncate hover:opacity-80"
                                                            style={{ backgroundColor: `${event.color}20`, color: event.color }}
                                                        >
                                                            {event.title}
                                                        </button>
                                                    ))}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {/* Day View */}
                    {view === 'day' && (
                        <>
                            {/* Day Header */}
                            <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                                <div className={cn(
                                    'text-center',
                                    isToday(currentDate) && 'text-teal-600 dark:text-teal-400'
                                )}>
                                    <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                        {currentDate.toLocaleDateString('en-US', { weekday: 'long' })}
                                    </div>
                                    <div className="text-3xl font-bold mt-1">
                                        {currentDate.getDate()}
                                    </div>
                                    <div className="text-sm text-slate-500 dark:text-slate-400">
                                        {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                    </div>
                                </div>
                            </div>

                            {/* Time Grid */}
                            <div className="overflow-y-auto max-h-[600px]">
                                {hours.slice(6, 22).map((hour) => {
                                    const hourEvents = getEventsForHour(currentDate, hour);
                                    const slotDate = new Date(currentDate);
                                    slotDate.setHours(hour, 0, 0, 0);
                                    return (
                                        <div key={hour} className="flex border-b border-slate-100 dark:border-slate-800">
                                            <div className="py-3 px-4 text-sm text-slate-400 text-right w-20 flex-shrink-0 border-r border-slate-200 dark:border-slate-700">
                                                {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                                            </div>
                                            <div
                                                onClick={() => handleDateClick(slotDate)}
                                                className="flex-1 min-h-[60px] p-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                            >
                                                {hourEvents.map((event) => (
                                                    <button
                                                        key={event.id}
                                                        onClick={(e) => handleEventClick(event, e)}
                                                        className="w-full text-left text-sm px-3 py-2 rounded-lg mb-1 hover:opacity-80"
                                                        style={{ backgroundColor: `${event.color}15`, borderLeft: `3px solid ${event.color}` }}
                                                    >
                                                        <div className="font-medium" style={{ color: event.color }}>{event.title}</div>
                                                        <div className="text-xs text-slate-500 mt-0.5">
                                                            {new Date(event.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(event.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                        {event.location && (
                                                            <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                                                                <MapPin className="w-3 h-3" />
                                                                {event.location}
                                                            </div>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>

                {/* Sidebar */}
                <div className="w-80 space-y-4 flex-shrink-0">
                    {/* Upcoming Tasks */}
                    <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                <h3 className="font-semibold text-slate-900 dark:text-white">Upcoming Tasks</h3>
                            </div>
                        </div>
                        <div className="p-4 space-y-3 max-h-[300px] overflow-y-auto">
                            {tasks.length === 0 ? (
                                <p className="text-sm text-slate-500 text-center py-4">No upcoming tasks</p>
                            ) : (
                                tasks.slice(0, 5).map((task) => (
                                    <div key={task.id} className="flex items-start gap-3">
                                        <button
                                            onClick={() => completeTask(task.id)}
                                            className="mt-0.5 w-4 h-4 rounded border-2 border-slate-300 dark:border-slate-600 hover:border-teal-500 hover:bg-teal-500 transition-colors flex-shrink-0 flex items-center justify-center group"
                                        >
                                            <Check className="w-3 h-3 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </button>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-slate-900 dark:text-white truncate">{task.title}</p>
                                            <p className="text-xs text-slate-500">
                                                {task.due_at ? new Date(task.due_at).toLocaleDateString() : 'No due date'}
                                            </p>
                                        </div>
                                        <span className={cn('w-2 h-2 rounded-full mt-1.5', getPriorityColor(task.priority))} />
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Today's Events */}
                    <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                            <div className="flex items-center gap-2">
                                <CalendarIcon className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                                <h3 className="font-semibold text-slate-900 dark:text-white">Today's Events</h3>
                            </div>
                        </div>
                        <div className="p-4 space-y-3">
                            {todaysEvents.length === 0 ? (
                                <div className="text-center py-4">
                                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mx-auto mb-2">
                                        <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    <p className="text-sm text-slate-500">No events today</p>
                                </div>
                            ) : (
                                todaysEvents.map((event) => (
                                    <button
                                        key={event.id}
                                        onClick={() => handleEventClick(event)}
                                        className="w-full text-left p-3 rounded-lg hover:opacity-80 transition-opacity"
                                        style={{ backgroundColor: `${event.color}10` }}
                                    >
                                        <p className="text-sm font-medium text-slate-900 dark:text-white">{event.title}</p>
                                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {new Date(event.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Connected Calendars */}
                    <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Link2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                    <h3 className="font-semibold text-slate-900 dark:text-white">Connected</h3>
                                </div>
                                <button
                                    onClick={() => setShowIntegrationModal(true)}
                                    className="text-xs text-teal-600 hover:underline"
                                >
                                    + Add
                                </button>
                            </div>
                        </div>
                        <div className="p-4 space-y-2">
                            {connectedCalendars.length === 0 ? (
                                <div className="text-center py-4">
                                    <p className="text-sm text-slate-500 mb-3">No calendars connected</p>
                                    <button
                                        onClick={() => setShowIntegrationModal(true)}
                                        className="text-sm text-teal-600 hover:underline"
                                    >
                                        Connect a calendar
                                    </button>
                                </div>
                            ) : (
                                connectedCalendars.map((cal) => (
                                    <div key={cal.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                        <div
                                            className="w-3 h-3 rounded-full"
                                            style={{ backgroundColor: cal.color }}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{cal.name}</p>
                                            <p className="text-xs text-slate-500 truncate">{cal.email}</p>
                                        </div>
                                        <button className="text-slate-400 hover:text-red-500">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Integration Modal */}
            <Dialog open={showIntegrationModal} onOpenChange={setShowIntegrationModal}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Connect Calendar</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 pt-4">
                        {/* Google Calendar */}
                        <button
                            onClick={() => connectCalendar('google')}
                            className="w-full flex items-center gap-4 p-4 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                        >
                            <div className="w-10 h-10 rounded-lg bg-white shadow flex items-center justify-center">
                                <svg viewBox="0 0 24 24" className="w-6 h-6">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                            </div>
                            <div className="flex-1 text-left">
                                <p className="font-medium text-slate-900 dark:text-white">Google Calendar</p>
                                <p className="text-sm text-slate-500">Sync events from Gmail</p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-400" />
                        </button>

                        {/* Outlook Calendar */}
                        <button
                            onClick={() => connectCalendar('outlook')}
                            className="w-full flex items-center gap-4 p-4 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                        >
                            <div className="w-10 h-10 rounded-lg bg-[#0078D4] flex items-center justify-center">
                                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
                                    <path d="M7.88 12.04q0 .45-.11.87-.1.41-.33.74-.22.33-.58.52-.37.2-.87.2t-.85-.2q-.35-.21-.57-.55-.22-.33-.33-.75-.1-.42-.1-.86t.1-.87q.1-.43.34-.76.22-.34.59-.54.36-.2.87-.2t.86.2q.35.21.57.55.22.34.31.77.1.43.1.88zM24 12v9.38q0 .46-.33.8-.33.32-.8.32H7.13q-.46 0-.8-.33-.32-.33-.32-.8V18H1q-.41 0-.7-.3-.3-.29-.3-.7V7q0-.41.3-.7Q.58 6 1 6h6.01V2.55q0-.44.3-.75.3-.3.75-.3h6.71l.1.05L14.8 3h6.2q.47 0 .8.33.33.34.33.8v6.38l-1.5-.05-.01-5.15H13.5V12h9zm-15.5 0h4v-.88q0-.9.3-1.62.29-.73.82-1.25.53-.53 1.25-.82.72-.3 1.62-.3t1.63.3q.72.29 1.24.82.53.52.82 1.24.3.73.3 1.63V12h1.5v8H8.5v-8zm4 0v-.89q0-.66-.21-1.19-.22-.52-.6-.9-.38-.38-.91-.58-.53-.2-1.16-.2-.64 0-1.17.2-.52.2-.9.58-.38.38-.59.9-.2.53-.2 1.19V12h5.74z" />
                                </svg>
                            </div>
                            <div className="flex-1 text-left">
                                <p className="font-medium text-slate-900 dark:text-white">Outlook Calendar</p>
                                <p className="text-sm text-slate-500">Sync with Microsoft 365</p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-400" />
                        </button>

                        {/* Personal Calendar */}
                        <button
                            onClick={() => connectCalendar('personal')}
                            className="w-full flex items-center gap-4 p-4 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all"
                        >
                            <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center">
                                <CalendarIcon className="w-6 h-6 text-white" />
                            </div>
                            <div className="flex-1 text-left">
                                <p className="font-medium text-slate-900 dark:text-white">Personal Calendar</p>
                                <p className="text-sm text-slate-500">CRM-only events</p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-400" />
                        </button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* New Event Modal */}
            <Dialog open={showNewEventModal} onOpenChange={(open) => {
                setShowNewEventModal(open);
                if (!open) {
                    // Reset form when closing
                    setNewEventTitle('');
                    setNewEventStart('');
                    setNewEventEnd('');
                    setNewEventLocation('');
                    setNewEventDescription('');
                    setNewEventType('meeting');
                }
            }}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>New Activity</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        {/* Activity Type Selector */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Activity Type
                            </label>
                            <div className="grid grid-cols-4 gap-2">
                                {[
                                    { type: 'meeting' as const, label: 'Meeting', icon: Users, color: 'teal' },
                                    { type: 'call' as const, label: 'Call', icon: Video, color: 'purple' },
                                    { type: 'task' as const, label: 'Task', icon: CheckCircle2, color: 'blue' },
                                    { type: 'email' as const, label: 'Email', icon: AlertCircle, color: 'amber' },
                                ].map(({ type, label, icon: Icon, color }) => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setNewEventType(type)}
                                        className={cn(
                                            'flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all',
                                            newEventType === type
                                                ? `border-${color}-500 bg-${color}-50 dark:bg-${color}-900/20`
                                                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                        )}
                                    >
                                        <Icon className={cn(
                                            'w-5 h-5',
                                            newEventType === type ? `text-${color}-600` : 'text-slate-400'
                                        )} />
                                        <span className={cn(
                                            'text-xs font-medium',
                                            newEventType === type ? `text-${color}-700 dark:text-${color}-400` : 'text-slate-600 dark:text-slate-400'
                                        )}>
                                            {label}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                {newEventType === 'task' ? 'Task Title' : newEventType === 'call' ? 'Call Subject' : 'Event Title'}
                            </label>
                            <input
                                type="text"
                                placeholder={newEventType === 'task' ? 'What needs to be done?' : newEventType === 'call' ? 'Who are you calling?' : 'Enter event title'}
                                value={newEventTitle}
                                onChange={(e) => setNewEventTitle(e.target.value)}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    {newEventType === 'task' ? 'Due Date' : 'Start Date & Time'}
                                </label>
                                <input
                                    type="datetime-local"
                                    value={newEventStart}
                                    onChange={(e) => setNewEventStart(e.target.value)}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                />
                            </div>
                            {newEventType !== 'task' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        End Date & Time
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={newEventEnd}
                                        onChange={(e) => setNewEventEnd(e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                    />
                                </div>
                            )}
                        </div>
                        {(newEventType === 'meeting' || newEventType === 'call') && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    {newEventType === 'meeting' ? 'Location' : 'Phone Number'}
                                </label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder={newEventType === 'meeting' ? 'Add location or video link' : 'Phone number'}
                                        value={newEventLocation}
                                        onChange={(e) => setNewEventLocation(e.target.value)}
                                        className="w-full pl-10 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                    />
                                </div>
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                {newEventType === 'task' ? 'Notes' : 'Description'}
                            </label>
                            <textarea
                                rows={3}
                                placeholder={newEventType === 'task' ? 'Add notes...' : 'Add description...'}
                                value={newEventDescription}
                                onChange={(e) => setNewEventDescription(e.target.value)}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                            />
                        </div>
                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <button
                                onClick={() => setShowNewEventModal(false)}
                                disabled={isCreatingEvent}
                                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    if (!newEventTitle.trim()) {
                                        toast.error(`Please enter a ${newEventType === 'task' ? 'task' : 'event'} title`);
                                        return;
                                    }
                                    if (!newEventStart) {
                                        toast.error(`Please select a ${newEventType === 'task' ? 'due date' : 'start date and time'}`);
                                        return;
                                    }
                                    if (!profileData) {
                                        toast.error('Unable to create. Please refresh the page.');
                                        return;
                                    }

                                    setIsCreatingEvent(true);
                                    try {
                                        const startDate = new Date(newEventStart);
                                        const duration = newEventType === 'call' ? 1800000 : 3600000; // 30min for calls, 1hr for others
                                        const endDate = newEventEnd ? new Date(newEventEnd) : new Date(startDate.getTime() + duration);

                                        // Create as a CRM task with the selected activity_type
                                        const { data: insertedTask, error } = await supabase
                                            .from('crm_tasks')
                                            .insert({
                                                org_id: profileData.organization_id,
                                                title: newEventTitle.trim(),
                                                description: newEventDescription.trim() || null,
                                                due_at: startDate.toISOString(),
                                                activity_type: newEventType,
                                                meeting_location: (newEventType === 'meeting' || newEventType === 'call') ? (newEventLocation.trim() || null) : null,
                                                status: 'open',
                                                priority: 'normal',
                                            } as any)
                                            .select('id')
                                            .single();

                                        if (error) throw error;

                                        // Determine color based on type
                                        const typeColors: Record<string, string> = {
                                            meeting: '#10B981',
                                            call: '#8B5CF6',
                                            task: '#3B82F6',
                                            email: '#F59E0B',
                                        };

                                        // Add to local events (for meetings and calls) or tasks (for tasks)
                                        if (newEventType === 'task') {
                                            setTasks(prev => [...prev, {
                                                id: insertedTask?.id || crypto.randomUUID(),
                                                title: newEventTitle.trim(),
                                                due_at: startDate.toISOString(),
                                                priority: 'normal',
                                                status: 'open',
                                            }]);
                                        } else {
                                            const newEvent: CalendarEvent = {
                                                id: insertedTask?.id || crypto.randomUUID(),
                                                title: newEventTitle.trim(),
                                                description: newEventDescription.trim() || undefined,
                                                start: startDate,
                                                end: endDate,
                                                location: newEventLocation.trim() || undefined,
                                                provider: 'personal',
                                                color: typeColors[newEventType],
                                                status: 'confirmed',
                                            };
                                            setEvents(prev => [...prev, newEvent]);
                                        }

                                        const successMessages: Record<string, string> = {
                                            meeting: 'Meeting scheduled successfully',
                                            call: 'Call scheduled successfully',
                                            task: 'Task created successfully',
                                            email: 'Email reminder created',
                                        };
                                        toast.success(successMessages[newEventType]);
                                        setShowNewEventModal(false);
                                        setNewEventTitle('');
                                        setNewEventStart('');
                                        setNewEventEnd('');
                                        setNewEventLocation('');
                                        setNewEventDescription('');
                                        setNewEventType('meeting');
                                    } catch (error) {
                                        console.error('Error creating activity:', error);
                                        toast.error('Failed to create activity');
                                    } finally {
                                        setIsCreatingEvent(false);
                                    }
                                }}
                                disabled={isCreatingEvent}
                                className="px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {isCreatingEvent && <Loader2 className="w-4 h-4 animate-spin" />}
                                {isCreatingEvent ? 'Creating...' : newEventType === 'task' ? 'Create Task' : 'Create Event'}
                            </button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Event Detail Modal */}
            <Dialog open={showEventDetailModal} onOpenChange={setShowEventDetailModal}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Event Details</DialogTitle>
                    </DialogHeader>
                    {selectedEvent && (
                        <div className="space-y-4 pt-4">
                            <div className="flex items-start gap-3">
                                <div
                                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                                    style={{ backgroundColor: `${selectedEvent.color}20` }}
                                >
                                    <CalendarIcon className="w-5 h-5" style={{ color: selectedEvent.color }} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-slate-900 dark:text-white">{selectedEvent.title}</h3>
                                    <p className="text-sm text-slate-500 mt-1">
                                        {new Date(selectedEvent.start).toLocaleDateString('en-US', {
                                            weekday: 'long',
                                            month: 'long',
                                            day: 'numeric',
                                            year: 'numeric',
                                        })}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center gap-3 text-sm">
                                    <Clock className="w-4 h-4 text-slate-400" />
                                    <span className="text-slate-700 dark:text-slate-300">
                                        {new Date(selectedEvent.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        {' - '}
                                        {new Date(selectedEvent.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>

                                {selectedEvent.location && (
                                    <div className="flex items-center gap-3 text-sm">
                                        <MapPin className="w-4 h-4 text-slate-400" />
                                        <span className="text-slate-700 dark:text-slate-300">{selectedEvent.location}</span>
                                    </div>
                                )}

                                {selectedEvent.description && (
                                    <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                                        <p className="text-sm text-slate-600 dark:text-slate-400">{selectedEvent.description}</p>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                                <button
                                    onClick={() => {
                                        completeTask(selectedEvent.id);
                                        setShowEventDetailModal(false);
                                    }}
                                    className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    <Check className="w-4 h-4" />
                                    Mark Complete
                                </button>
                                <button
                                    onClick={() => setShowEventDetailModal(false)}
                                    className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
