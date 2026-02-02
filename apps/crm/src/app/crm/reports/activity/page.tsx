import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getCurrentProfile } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ActivityReportClient } from './client';

// Types
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

// Server-side calculations
function calculateStats(tasks: TaskData[]): ActivityStats {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const completed = tasks.filter(t => t.status === 'completed');
  const thisWeek = tasks.filter(t => new Date(t.created_at) >= oneWeekAgo);
  const overdue = tasks.filter(t => {
    if (t.status === 'completed') return false;
    if (!t.due_at) return false;
    return new Date(t.due_at) < now;
  });

  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const last30Days = tasks.filter(t => new Date(t.created_at) >= thirtyDaysAgo);
  const avgPerDay = Math.round(last30Days.length / 30 * 10) / 10;

  return {
    totalActivities: tasks.length,
    completedActivities: completed.length,
    completionRate: tasks.length > 0 ? Math.round((completed.length / tasks.length) * 100) : 0,
    avgActivitiesPerDay: avgPerDay,
    overdueActivities: overdue.length,
    activitiesThisWeek: thisWeek.length,
  };
}

function calculateActivityTypes(tasks: TaskData[]): ActivityByType[] {
  const typeMap = new Map<string, { count: number; completed: number }>();

  tasks.forEach(task => {
    const type = task.activity_type || 'task';
    const existing = typeMap.get(type) || { count: 0, completed: 0 };
    existing.count++;
    if (task.status === 'completed') existing.completed++;
    typeMap.set(type, existing);
  });

  return Array.from(typeMap.entries())
    .map(([type, data]) => ({
      type,
      count: data.count,
      completed: data.completed,
    }))
    .sort((a, b) => b.count - a.count);
}

function calculateUserActivities(tasks: TaskData[], profileMap: Map<string, ProfileData>): UserActivity[] {
  const userMap = new Map<string, { total: number; completed: number }>();

  tasks.forEach(task => {
    if (!task.assigned_to) return;
    const existing = userMap.get(task.assigned_to) || { total: 0, completed: 0 };
    existing.total++;
    if (task.status === 'completed') existing.completed++;
    userMap.set(task.assigned_to, existing);
  });

  return Array.from(userMap.entries())
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
}

function calculateWeeklyTrend(tasks: TaskData[]): DailyActivity[] {
  const now = new Date();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekData: DailyActivity[] = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const dayTasks = tasks.filter(t => {
      const created = new Date(t.created_at);
      return created >= date && created < nextDate;
    });

    const completedOnDay = tasks.filter(t => {
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

  return weekData;
}

export default async function ActivityReportPage() {
  // Use cached profile lookup (single request, memoized)
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect('/auth/login');
  }

  const supabase = await createServerSupabaseClient();

  // Fetch tasks and profiles in parallel
  const [tasksResult, profilesResult] = await Promise.all([
    supabase
      .from('crm_tasks')
      .select('id, title, activity_type, status, assigned_to, due_at, completed_at, created_at')
      .eq('org_id', profile.organization_id)
      .order('created_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .eq('organization_id', profile.organization_id),
  ]);

  const tasks = (tasksResult.data || []) as TaskData[];
  const profiles = (profilesResult.data || []) as ProfileData[];

  const profileMap = new Map<string, ProfileData>();
  profiles.forEach(p => profileMap.set(p.id, p));

  // Calculate all data on the server
  const stats = calculateStats(tasks);
  const activityTypes = calculateActivityTypes(tasks);
  const userActivities = calculateUserActivities(tasks, profileMap);
  const weeklyTrend = calculateWeeklyTrend(tasks);

  return (
    <ActivityReportClient
      tasks={tasks}
      stats={stats}
      activityTypes={activityTypes}
      userActivities={userActivities}
      weeklyTrend={weeklyTrend}
    />
  );
}
