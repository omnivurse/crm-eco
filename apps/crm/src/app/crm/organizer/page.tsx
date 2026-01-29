'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import {
    CheckCircle2,
    AlertTriangle,
    UserPlus,
    TrendingDown,
    Calendar,
    ListTodo,
    StickyNote,
    Plus,
    ArrowRight,
    Clock,
    Check,
    Loader2,
    RefreshCcw,
    CircleDot,
    Save,
} from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import { toast } from 'sonner';

interface QuickStat {
    label: string;
    value: number;
    icon: React.ReactNode;
    color: string;
    bgColor: string;
    href: string;
}

interface Task {
    id: string;
    title: string;
    status: string;
    priority: string;
    due_date: string | null;
}

interface Note {
    id: string;
    title: string;
    content: string;
    created_at: string;
}

export default function OrganizerPage() {
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState('');
    const [stats, setStats] = useState({ tasksDue: 0, overdue: 0, newLeads: 0, dealsAtRisk: 0 });
    const [tasks, setTasks] = useState<Task[]>([]);
    const [notes, setNotes] = useState<Note[]>([]);
    const [scratchpad, setScratchpad] = useState('');
    const [savingNote, setSavingNote] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Update time every minute
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // Load data
    useEffect(() => {
        async function loadData() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                // Get profile
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name, organization_id')
                    .eq('user_id', user.id)
                    .single();

                if (profile) {
                    setUserName(profile.full_name?.split(' ')[0] || 'there');

                    // Get tasks due today
                    const today = new Date().toISOString().split('T')[0];
                    const { data: todayTasks, count: tasksDueCount } = await supabase
                        .from('tasks')
                        .select('*', { count: 'exact' })
                        .eq('organization_id', profile.organization_id)
                        .gte('due_date', today)
                        .lte('due_date', today + 'T23:59:59')
                        .neq('status', 'completed')
                        .limit(5);

                    // Get overdue tasks
                    const { count: overdueCount } = await supabase
                        .from('tasks')
                        .select('*', { count: 'exact', head: true })
                        .eq('organization_id', profile.organization_id)
                        .lt('due_date', today)
                        .neq('status', 'completed');

                    // Get new leads (last 7 days)
                    const weekAgo = new Date();
                    weekAgo.setDate(weekAgo.getDate() - 7);

                    // First get leads module ID
                    const { data: leadsModule } = await supabase
                        .from('crm_modules')
                        .select('id')
                        .eq('org_id', profile.organization_id)
                        .eq('key', 'leads')
                        .single();

                    let newLeadsCount = 0;
                    if (leadsModule) {
                        const { count } = await supabase
                            .from('crm_records')
                            .select('*', { count: 'exact', head: true })
                            .eq('module_id', leadsModule.id)
                            .gte('created_at', weekAgo.toISOString());
                        newLeadsCount = count || 0;
                    }

                    // Get deals at risk (stale deals)
                    const { data: dealsModule } = await supabase
                        .from('crm_modules')
                        .select('id')
                        .eq('org_id', profile.organization_id)
                        .eq('key', 'deals')
                        .single();

                    let dealsAtRiskCount = 0;
                    if (dealsModule) {
                        const { count } = await supabase
                            .from('crm_records')
                            .select('*', { count: 'exact', head: true })
                            .eq('module_id', dealsModule.id)
                            .lt('updated_at', weekAgo.toISOString());
                        dealsAtRiskCount = count || 0;
                    }

                    setStats({
                        tasksDue: tasksDueCount || 0,
                        overdue: overdueCount || 0,
                        newLeads: newLeadsCount,
                        dealsAtRisk: dealsAtRiskCount,
                    });

                    setTasks(todayTasks || []);

                    // Get recent notes
                    const { data: recentNotes } = await supabase
                        .from('notes')
                        .select('id, title, content, created_at')
                        .eq('user_id', user.id)
                        .order('created_at', { ascending: false })
                        .limit(5);

                    setNotes(recentNotes || []);

                    // Get scratchpad
                    const saved = localStorage.getItem('crm-scratchpad');
                    if (saved) setScratchpad(saved);
                }
            } catch (error) {
                console.error('Error loading organizer data:', error);
                toast.error('Failed to load organizer data');
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, [supabase]);

    // Auto-save scratchpad
    useEffect(() => {
        const timeout = setTimeout(() => {
            localStorage.setItem('crm-scratchpad', scratchpad);
        }, 500);
        return () => clearTimeout(timeout);
    }, [scratchpad]);

    const saveNote = async () => {
        if (!scratchpad.trim()) return;
        setSavingNote(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const { data, error } = await supabase
                .from('notes')
                .insert({
                    user_id: user.id,
                    title: 'Quick Note',
                    content: scratchpad,
                })
                .select()
                .single();

            if (error) throw error;

            setNotes(prev => [data, ...prev.slice(0, 4)]);
            setScratchpad('');
            localStorage.removeItem('crm-scratchpad');
            toast.success('Note saved');
        } catch (error) {
            console.error('Error saving note:', error);
            toast.error('Failed to save note');
        } finally {
            setSavingNote(false);
        }
    };

    const getGreeting = () => {
        const hour = currentTime.getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 17) return 'Good afternoon';
        return 'Good evening';
    };

    const formatDate = () => {
        return currentTime.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const formatTime = () => {
        return currentTime.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    };

    const quickStats: QuickStat[] = [
        {
            label: 'Tasks Due',
            value: stats.tasksDue,
            icon: <ListTodo className="w-5 h-5" />,
            color: 'text-blue-600 dark:text-blue-400',
            bgColor: 'bg-blue-100 dark:bg-blue-500/20',
            href: '/crm/tasks',
        },
        {
            label: 'Overdue',
            value: stats.overdue,
            icon: <AlertTriangle className="w-5 h-5" />,
            color: 'text-amber-600 dark:text-amber-400',
            bgColor: 'bg-amber-100 dark:bg-amber-500/20',
            href: '/crm/tasks?filter=overdue',
        },
        {
            label: 'New Leads',
            value: stats.newLeads,
            icon: <UserPlus className="w-5 h-5" />,
            color: 'text-emerald-600 dark:text-emerald-400',
            bgColor: 'bg-emerald-100 dark:bg-emerald-500/20',
            href: '/crm/modules/leads',
        },
        {
            label: 'Deals at Risk',
            value: stats.dealsAtRisk,
            icon: <TrendingDown className="w-5 h-5" />,
            color: 'text-red-600 dark:text-red-400',
            bgColor: 'bg-red-100 dark:bg-red-500/20',
            href: '/crm/deals?filter=at-risk',
        },
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                        {getGreeting()}, <span className="gradient-text">{userName}</span>
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">{formatDate()}</p>
                </div>
                <div className="text-right">
                    <p className="text-3xl font-bold text-slate-900 dark:text-white tabular-nums">{formatTime()}</p>
                    <div className="inline-flex items-center gap-1.5 mt-1 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm font-medium">
                        <CircleDot className="w-3 h-3" />
                        All systems nominal
                    </div>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {quickStats.map((stat) => (
                    <Link
                        key={stat.label}
                        href={stat.href}
                        className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:border-teal-500/50 transition-all group"
                    >
                        <div className="flex items-center justify-between">
                            <div className={cn('p-2 rounded-lg', stat.bgColor)}>
                                <div className={stat.color}>{stat.icon}</div>
                            </div>
                            <span className={cn('text-2xl font-bold', stat.color)}>{stat.value}</span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-3 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                            {stat.label}
                        </p>
                    </Link>
                ))}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Today's Schedule */}
                <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                            <h2 className="font-semibold text-slate-900 dark:text-white">Today's Schedule</h2>
                        </div>
                        <span className="text-sm text-slate-500">0 events</span>
                    </div>
                    <div className="p-6 text-center">
                        <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                            <Check className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <p className="font-medium text-slate-900 dark:text-white">No meetings today</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Clear schedule for focused work</p>
                    </div>
                    <div className="px-4 pb-4">
                        <div className="flex items-center justify-between py-2 px-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                            <span className="text-sm text-slate-600 dark:text-slate-400">FREE TIME</span>
                            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                8h free today
                            </span>
                        </div>
                    </div>
                    <div className="px-4 pb-4">
                        <Link
                            href="/crm/integrations/calendar"
                            className="text-sm text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
                        >
                            Connect Google or Outlook calendar
                            <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                </div>

                {/* Task Command */}
                <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2">
                            <ListTodo className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                            <h2 className="font-semibold text-slate-900 dark:text-white">Task Command</h2>
                        </div>
                        <Link href="/crm/tasks" className="text-sm text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1">
                            View all <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                    {tasks.length === 0 ? (
                        <div className="p-6 text-center">
                            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                                <Check className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <p className="font-medium text-slate-900 dark:text-white">All caught up!</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">No urgent tasks for today</p>
                        </div>
                    ) : (
                        <div className="p-4 space-y-2">
                            {tasks.slice(0, 4).map((task) => (
                                <div
                                    key={task.id}
                                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                >
                                    <button className="w-5 h-5 rounded border-2 border-slate-300 dark:border-slate-600 hover:border-teal-500 transition-colors flex-shrink-0" />
                                    <span className="text-sm text-slate-700 dark:text-slate-300 truncate">{task.title}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="px-4 pb-4">
                        <Link
                            href="/crm/tasks/new"
                            className="flex items-center justify-center gap-2 w-full py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Add Task
                        </Link>
                    </div>
                </div>

                {/* Notes */}
                <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2">
                            <StickyNote className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                            <h2 className="font-semibold text-slate-900 dark:text-white">Notes</h2>
                        </div>
                        <button className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors">
                            <Plus className="w-4 h-4 text-slate-500" />
                        </button>
                    </div>
                    <div className="p-4">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Today's Scratchpad</p>
                        <textarea
                            value={scratchpad}
                            onChange={(e) => setScratchpad(e.target.value)}
                            placeholder="Capture thoughts, meeting notes, ideas... (⌘N to focus)"
                            className="w-full h-24 p-3 text-sm bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg resize-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-slate-900 dark:text-white placeholder:text-slate-400"
                        />
                        <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-slate-400">Auto-saved</span>
                            <button
                                onClick={saveNote}
                                disabled={savingNote || !scratchpad.trim()}
                                className="inline-flex items-center gap-1 text-xs text-teal-600 dark:text-teal-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {savingNote ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                Save Note
                            </button>
                        </div>
                    </div>
                    <div className="px-4 pb-4">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Recent Notes</p>
                        {notes.length === 0 ? (
                            <p className="text-sm text-slate-400 dark:text-slate-500">No notes yet</p>
                        ) : (
                            <div className="space-y-2">
                                {notes.slice(0, 3).map((note) => (
                                    <div key={note.id} className="p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
                                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{note.title}</p>
                                        <p className="text-xs text-slate-500 truncate">{note.content?.slice(0, 50)}...</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Quick Actions</h3>
                <div className="flex flex-wrap gap-2">
                    <Link
                        href="/crm/modules/leads/new"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 transition-colors"
                    >
                        <UserPlus className="w-4 h-4" />
                        Add Lead
                    </Link>
                    <Link
                        href="/crm/modules/contacts/new"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 transition-colors"
                    >
                        <UserPlus className="w-4 h-4" />
                        Add Contact
                    </Link>
                    <Link
                        href="/crm/tasks/new"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 transition-colors"
                    >
                        <ListTodo className="w-4 h-4" />
                        Create Task
                    </Link>
                    <Link
                        href="/crm/scheduling"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 transition-colors"
                    >
                        <Calendar className="w-4 h-4" />
                        Schedule Meeting
                    </Link>
                    <Link
                        href="/crm/import"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 transition-colors"
                    >
                        <RefreshCcw className="w-4 h-4" />
                        Import Data
                    </Link>
                </div>
            </div>
        </div>
    );
}
