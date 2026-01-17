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
    due_date: string;
    priority: string;
    status: string;
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
                    .select('organization_id')
                    .eq('user_id', user.id)
                    .single();

                if (profile) {
                    // Load tasks
                    const { data: tasksData } = await supabase
                        .from('tasks')
                        .select('id, title, due_date, priority, status')
                        .eq('organization_id', profile.organization_id)
                        .neq('status', 'completed')
                        .order('due_date', { ascending: true })
                        .limit(10);

                    setTasks(tasksData || []);

                    // Load events (mock for now - in production would come from integrated calendars)
                    const mockEvents: CalendarEvent[] = [
                        {
                            id: '1',
                            title: 'Client Meeting - John Smith',
                            start: new Date(),
                            end: new Date(Date.now() + 3600000),
                            provider: 'google',
                            color: PROVIDER_COLORS.google,
                        },
                    ];
                    setEvents(mockEvents);

                    // Load connected calendars (mock - would come from DB)
                    setConnectedCalendars([]);
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

    // Format month/year header
    const formatHeader = () => {
        return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    };

    // Connect calendar provider
    const connectCalendar = async (provider: CalendarProvider) => {
        toast.info(`Connecting to ${PROVIDER_NAMES[provider]}...`);

        // In production, this would initiate OAuth flow
        // For now, simulate connection
        setTimeout(() => {
            const newCalendar: ConnectedCalendar = {
                id: `${provider}-${Date.now()}`,
                provider,
                email: provider === 'google' ? 'user@gmail.com' : provider === 'outlook' ? 'user@outlook.com' : 'personal',
                name: PROVIDER_NAMES[provider],
                color: PROVIDER_COLORS[provider],
                enabled: true,
            };
            setConnectedCalendars(prev => [...prev, newCalendar]);
            toast.success(`Connected to ${PROVIDER_NAMES[provider]}`);
            setShowIntegrationModal(false);
        }, 1500);
    };

    // Get priority badge color
    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'urgent': return 'bg-red-500';
            case 'high': return 'bg-orange-500';
            case 'medium': return 'bg-yellow-500';
            default: return 'bg-slate-400';
        }
    };

    // Today's events
    const todaysEvents = events.filter(e => isToday(new Date(e.start)));

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
                                    onClick={() => setSelectedDate(date)}
                                    className={cn(
                                        'h-28 p-2 border-b border-r border-slate-100 dark:border-slate-800 cursor-pointer transition-colors',
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
                                            <div
                                                key={event.id}
                                                className="text-xs px-1.5 py-0.5 rounded truncate"
                                                style={{ backgroundColor: `${event.color}20`, color: event.color }}
                                            >
                                                {event.title}
                                            </div>
                                        ))}
                                        {dayEvents.length > 2 && (
                                            <div className="text-xs text-slate-500 pl-1">+{dayEvents.length - 2} more</div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
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
                                        <button className="mt-0.5 w-4 h-4 rounded border-2 border-slate-300 dark:border-slate-600 hover:border-teal-500 transition-colors flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-slate-900 dark:text-white truncate">{task.title}</p>
                                            <p className="text-xs text-slate-500">
                                                {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date'}
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
                                    <div
                                        key={event.id}
                                        className="p-3 rounded-lg"
                                        style={{ backgroundColor: `${event.color}10` }}
                                    >
                                        <p className="text-sm font-medium text-slate-900 dark:text-white">{event.title}</p>
                                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {new Date(event.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
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
            <Dialog open={showNewEventModal} onOpenChange={setShowNewEventModal}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>New Event</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Event Title
                            </label>
                            <input
                                type="text"
                                placeholder="Enter event title"
                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Start Date & Time
                                </label>
                                <input
                                    type="datetime-local"
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    End Date & Time
                                </label>
                                <input
                                    type="datetime-local"
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Calendar
                            </label>
                            <select className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent">
                                <option>Personal Calendar</option>
                                {connectedCalendars.map((cal) => (
                                    <option key={cal.id}>{cal.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Location
                            </label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Add location or video link"
                                    className="w-full pl-10 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Description
                            </label>
                            <textarea
                                rows={3}
                                placeholder="Add description..."
                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                            />
                        </div>
                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <button
                                onClick={() => setShowNewEventModal(false)}
                                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    toast.success('Event created');
                                    setShowNewEventModal(false);
                                }}
                                className="px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white rounded-lg transition-colors"
                            >
                                Create Event
                            </button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
