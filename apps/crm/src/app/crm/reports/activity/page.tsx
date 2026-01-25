'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  Download,
  Loader2,
  Phone,
  Mail,
  MessageSquare,
  CheckSquare,
  Users,
  Clock,
  Activity,
  User,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { cn } from '@crm-eco/ui/lib/utils';

// ============================================================================
// Type Definitions
// ============================================================================

interface TaskData {
  id: string;
  title: string;
  activity_type: string;
  status: string;
  assigned_to: string | null;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface ProfileData {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface ActivityStats {
  totalActivities: number;
  completedActivities: number;
  completionRate: number;
  avgActivitiesPerDay: number;
  overdueActivities: number;
  activitiesThisWeek: number;
}

interface ActivityByType {
  type: string;
  count: number;
  completed: number;
  icon: React.ElementType;
  color: string;
}

interface UserActivity {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  totalActivities: number;
  completedActivities: number;
  completionRate: number;
}

interface DailyActivity {
  day: string;
  created: number;
  completed: number;
}

// ============================================================================
// Components
// ============================================================================

function StatCard({
  label,
  value,
  change,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  change?: number;
  icon: React.ElementType;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    teal: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
  };

  return (
    <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={cn('p-2.5 rounded-lg', colorClasses[color])}>
          <Icon className="w-5 h-5" />
        </div>
        {change !== undefined && (
          <div className={cn('flex items-center gap-1 text-sm', change >= 0 ? 'text-emerald-600' : 'text-red-600')}>
            {change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span>{change >= 0 ? '+' : ''}{change}%</span>
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-slate-900 dark:text-white">{value}</div>
      <div className="text-sm text-slate-500">{label}</div>
    </div>
  );
}

function ActivityTypeChart({ data }: { data: ActivityByType[] }) {
  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">Activities by Type</h3>
          <p className="text-sm text-slate-500">Breakdown of activity categories</p>
        </div>
      </div>

      <div className="space-y-4">
        {data.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.type} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className={cn('p-1.5 rounded', item.color)}>
                    <Icon className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-slate-700 dark:text-slate-300 capitalize">{item.type}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-slate-500">{item.count} total</span>
                  <span className="text-emerald-600 font-medium">{item.completed} done</span>
                </div>
              </div>
              <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', item.color)}
                  style={{ width: `${(item.count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
        {data.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No activity data available</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TeamLeaderboard({ users }: { users: UserActivity[] }) {
  return (
    <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">Team Productivity</h3>
          <p className="text-sm text-slate-500">Activity completion by team member</p>
        </div>
      </div>

      <div className="space-y-3">
        {users.map((user, index) => (
          <div
            key={user.userId}
            className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
          >
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400">
              {index + 1}
            </div>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium">
              {user.userName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-900 dark:text-white truncate">{user.userName}</p>
              <p className="text-xs text-slate-500">
                {user.completedActivities} / {user.totalActivities} activities
              </p>
            </div>
            <div className="text-right">
              <p className={cn(
                'text-sm font-semibold',
                user.completionRate >= 80 ? 'text-emerald-600' :
                user.completionRate >= 50 ? 'text-amber-600' : 'text-red-600'
              )}>
                {user.completionRate}%
              </p>
              <p className="text-xs text-slate-500">completed</p>
            </div>
          </div>
        ))}
        {users.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No team activity data</p>
          </div>
        )}
      </div>
    </div>
  );
}

function WeeklyTrend({ data }: { data: DailyActivity[] }) {
  const maxValue = Math.max(...data.flatMap(d => [d.created, d.completed]), 1);

  return (
    <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">Weekly Activity Trend</h3>
          <p className="text-sm text-slate-500">Daily created vs completed activities</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500" />
            Created
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500" />
            Completed
          </span>
        </div>
      </div>

      <div className="h-48 flex items-end gap-4">
        {data.map((day) => (
          <div key={day.day} className="flex-1 flex flex-col items-center gap-2">
            <div className="w-full flex items-end justify-center gap-1 h-40">
              <div
                className="w-5 bg-blue-500 rounded-t transition-all"
                style={{ height: `${maxValue > 0 ? (day.created / maxValue) * 100 : 0}%`, minHeight: day.created > 0 ? '4px' : '0' }}
              />
              <div
                className="w-5 bg-emerald-500 rounded-t transition-all"
                style={{ height: `${maxValue > 0 ? (day.completed / maxValue) * 100 : 0}%`, minHeight: day.completed > 0 ? '4px' : '0' }}
              />
            </div>
            <div className="text-xs text-slate-500 font-medium">{day.day}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OverdueActivities({ tasks }: { tasks: TaskData[] }) {
  const overdue = tasks
    .filter(t => {
      if (t.status === 'completed') return false;
      if (!t.due_at) return false;
      return new Date(t.due_at) < new Date();
    })
    .slice(0, 5);

  return (
    <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
      <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
        <Clock className="w-5 h-5 text-rose-500" />
        Overdue Activities
      </h3>

      <div className="space-y-3">
        {overdue.map((task) => {
          const daysOverdue = Math.floor(
            (new Date().getTime() - new Date(task.due_at!).getTime()) / (1000 * 60 * 60 * 24)
          );
          return (
            <div
              key={task.id}
              className="flex items-center justify-between p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-lg"
            >
              <div>
                <p className="font-medium text-slate-900 dark:text-white">{task.title}</p>
                <p className="text-sm text-slate-500 capitalize">{task.activity_type || 'Task'}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-rose-600">{daysOverdue} days overdue</p>
              </div>
            </div>
          );
        })}
        {overdue.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No overdue activities</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function ActivityReportPage() {
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [stats, setStats] = useState<ActivityStats>({
    totalActivities: 0,
    completedActivities: 0,
    completionRate: 0,
    avgActivitiesPerDay: 0,
    overdueActivities: 0,
    activitiesThisWeek: 0,
  });
  const [activityTypes, setActivityTypes] = useState<ActivityByType[]>([]);
  const [userActivities, setUserActivities] = useState<UserActivity[]>([]);
  const [weeklyTrend, setWeeklyTrend] = useState<DailyActivity[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ProfileData>>(new Map());

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;

      // Fetch all tasks/activities
      const { data: tasksData } = await supabase
        .from('crm_tasks')
        .select('id, title, activity_type, status, assigned_to, due_at, completed_at, created_at')
        .eq('org_id', profile.organization_id)
        .order('created_at', { ascending: false });

      const allTasks = (tasksData || []) as TaskData[];
      setTasks(allTasks);

      // Fetch profiles for user names
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('organization_id', profile.organization_id);

      const profileMap = new Map<string, ProfileData>();
      (profilesData || []).forEach((p: ProfileData) => {
        profileMap.set(p.id, p);
      });
      setProfiles(profileMap);

      // Calculate stats
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const completed = allTasks.filter(t => t.status === 'completed');
      const thisWeek = allTasks.filter(t => new Date(t.created_at) >= oneWeekAgo);
      const overdue = allTasks.filter(t => {
        if (t.status === 'completed') return false;
        if (!t.due_at) return false;
        return new Date(t.due_at) < now;
      });

      // Calculate average activities per day (last 30 days)
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const last30Days = allTasks.filter(t => new Date(t.created_at) >= thirtyDaysAgo);
      const avgPerDay = Math.round(last30Days.length / 30 * 10) / 10;

      setStats({
        totalActivities: allTasks.length,
        completedActivities: completed.length,
        completionRate: allTasks.length > 0 ? Math.round((completed.length / allTasks.length) * 100) : 0,
        avgActivitiesPerDay: avgPerDay,
        overdueActivities: overdue.length,
        activitiesThisWeek: thisWeek.length,
      });

      // Calculate activity types
      const typeIcons: Record<string, { icon: React.ElementType; color: string }> = {
        call: { icon: Phone, color: 'bg-blue-500' },
        email: { icon: Mail, color: 'bg-violet-500' },
        meeting: { icon: Users, color: 'bg-amber-500' },
        task: { icon: CheckSquare, color: 'bg-emerald-500' },
        note: { icon: MessageSquare, color: 'bg-rose-500' },
        other: { icon: Activity, color: 'bg-slate-500' },
      };

      const typeMap = new Map<string, { count: number; completed: number }>();
      allTasks.forEach(task => {
        const type = task.activity_type || 'task';
        const existing = typeMap.get(type) || { count: 0, completed: 0 };
        existing.count++;
        if (task.status === 'completed') existing.completed++;
        typeMap.set(type, existing);
      });

      const types: ActivityByType[] = Array.from(typeMap.entries())
        .map(([type, data]) => ({
          type,
          count: data.count,
          completed: data.completed,
          icon: typeIcons[type]?.icon || Activity,
          color: typeIcons[type]?.color || 'bg-slate-500',
        }))
        .sort((a, b) => b.count - a.count);
      setActivityTypes(types);

      // Calculate user activities
      const userMap = new Map<string, { total: number; completed: number }>();
      allTasks.forEach(task => {
        if (!task.assigned_to) return;
        const existing = userMap.get(task.assigned_to) || { total: 0, completed: 0 };
        existing.total++;
        if (task.status === 'completed') existing.completed++;
        userMap.set(task.assigned_to, existing);
      });

      const users: UserActivity[] = Array.from(userMap.entries())
        .map(([userId, data]) => {
          const userProfile = profileMap.get(userId);
          return {
            userId,
            userName: userProfile?.full_name || 'Unknown User',
            avatarUrl: userProfile?.avatar_url || null,
            totalActivities: data.total,
            completedActivities: data.completed,
            completionRate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
          };
        })
        .sort((a, b) => b.completionRate - a.completionRate)
        .slice(0, 5);
      setUserActivities(users);

      // Calculate weekly trend (last 7 days)
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const weekData: DailyActivity[] = [];

      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const dayTasks = allTasks.filter(t => {
          const created = new Date(t.created_at);
          return created >= date && created < nextDate;
        });

        const completedOnDay = allTasks.filter(t => {
          if (!t.completed_at) return false;
          const completedAt = new Date(t.completed_at);
          return completedAt >= date && completedAt < nextDate;
        });

        weekData.push({
          day: days[date.getDay()],
          created: dayTasks.length,
          completed: completedOnDay.length,
        });
      }
      setWeeklyTrend(weekData);

    } catch (error) {
      console.error('Error loading activity data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/crm/reports">
            <Button variant="ghost" size="sm">
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-lg">
                <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Activity Report</h1>
            </div>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Team productivity and engagement
            </p>
          </div>
        </div>

        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Total Activities" value={stats.totalActivities.toLocaleString()} icon={Activity} color="blue" />
        <StatCard label="Completed" value={stats.completedActivities} icon={CheckSquare} color="emerald" />
        <StatCard label="Completion Rate" value={`${stats.completionRate}%`} icon={TrendingUp} color="violet" />
        <StatCard label="Avg Per Day" value={stats.avgActivitiesPerDay} icon={Calendar} color="amber" />
        <StatCard label="This Week" value={stats.activitiesThisWeek} icon={Clock} color="teal" />
        <StatCard label="Overdue" value={stats.overdueActivities} icon={Clock} color="rose" />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActivityTypeChart data={activityTypes} />
        <TeamLeaderboard users={userActivities} />
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WeeklyTrend data={weeklyTrend} />
        <OverdueActivities tasks={tasks} />
      </div>
    </div>
  );
}
