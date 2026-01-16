import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { 
  Plus, 
  Filter, 
  Search,
  Phone,
  Users,
  Mail,
  CheckSquare,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Badge } from '@crm-eco/ui/components/badge';
import { getCurrentProfile, getAllActivities } from '@/lib/crm/queries';
import type { CrmTaskWithAssignee, ActivityType } from '@/lib/crm/types';
import { formatDistanceToNow } from 'date-fns';

interface PageProps {
  searchParams: Promise<{
    type?: string;
    status?: string;
    page?: string;
  }>;
}

const ACTIVITY_ICONS: Record<ActivityType, React.ReactNode> = {
  task: <CheckSquare className="w-4 h-4" />,
  call: <Phone className="w-4 h-4" />,
  meeting: <Users className="w-4 h-4" />,
  email: <Mail className="w-4 h-4" />,
};

const ACTIVITY_COLORS: Record<ActivityType, string> = {
  task: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  call: 'bg-green-500/10 text-green-400 border-green-500/30',
  meeting: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  email: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
};

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  in_progress: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  completed: 'bg-green-500/10 text-green-400 border-green-500/30',
  cancelled: 'bg-red-500/10 text-red-400 border-red-500/30',
};

function ActivityRow({ activity }: { activity: CrmTaskWithAssignee }) {
  const Icon = ACTIVITY_ICONS[activity.activity_type] || ACTIVITY_ICONS.task;
  const colorClass = ACTIVITY_COLORS[activity.activity_type] || ACTIVITY_COLORS.task;
  const statusClass = STATUS_COLORS[activity.status] || STATUS_COLORS.open;
  
  return (
    <div className="flex items-center gap-4 p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
      <div className={`p-2 rounded-lg ${colorClass}`}>
        {Icon}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-white truncate">{activity.title}</h3>
          <Badge variant="outline" className={statusClass}>
            {activity.status.replace('_', ' ')}
          </Badge>
        </div>
        <div className="flex items-center gap-3 mt-1 text-sm text-slate-400">
          <span className="capitalize">{activity.activity_type}</span>
          {activity.due_at && (
            <>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(activity.due_at).toLocaleDateString()}
              </span>
            </>
          )}
          {activity.assignee && (
            <>
              <span>•</span>
              <span>{activity.assignee.full_name}</span>
            </>
          )}
        </div>
      </div>
      
      <div className="text-sm text-slate-500">
        {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
      </div>
    </div>
  );
}

async function ActivitiesContent({ searchParams }: PageProps) {
  const profile = await getCurrentProfile();
  if (!profile) return notFound();

  const params = await searchParams;
  const activityType = params.type;
  const status = params.status;
  const page = parseInt(params.page || '1', 10);
  const pageSize = 25;

  const activities = await getAllActivities(profile.organization_id, {
    activityType,
    status,
    limit: 100, // Get more than needed for client-side pagination
  });

  const total = activities.length;
  const totalPages = Math.ceil(total / pageSize);
  const paginatedActivities = activities.slice((page - 1) * pageSize, page * pageSize);

  // Get counts by type for the filter tabs
  const countByType = activities.reduce((acc, a) => {
    acc[a.activity_type] = (acc[a.activity_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Activities</h1>
            <p className="text-slate-400 mt-0.5">
              {total.toLocaleString()} {total === 1 ? 'activity' : 'activities'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white glow-sm hover:glow-md transition-all"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Activity
          </Button>
        </div>
      </div>

      {/* Toolbar with Filters */}
      <div className="glass-card rounded-2xl p-4 border border-white/10">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              type="search"
              placeholder="Search activities..."
              className="pl-11 h-10 rounded-xl bg-slate-900/50 border-white/10 text-white placeholder:text-slate-500 focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
          
          <div className="flex items-center gap-3">
            {/* Activity Type Filters */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-900/50 border border-white/10">
              <Link
                href="/crm/activities"
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  !activityType 
                    ? 'bg-white/10 text-white' 
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                All ({total})
              </Link>
              {(['task', 'call', 'meeting', 'email'] as ActivityType[]).map((type) => (
                <Link
                  key={type}
                  href={`/crm/activities?type=${type}`}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    activityType === type
                      ? 'bg-white/10 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {ACTIVITY_ICONS[type]}
                  <span className="hidden sm:inline capitalize">{type}s</span>
                  <span className="text-xs text-slate-500">({countByType[type] || 0})</span>
                </Link>
              ))}
            </div>

            {/* Status Filter */}
            <Button 
              variant="outline" 
              className="h-10 px-3 rounded-xl bg-slate-900/50 border-white/10 text-slate-300 hover:text-white hover:border-white/20"
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
          </div>
        </div>
      </div>

      {/* Activities List */}
      <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
        {paginatedActivities.length > 0 ? (
          paginatedActivities.map((activity) => (
            <ActivityRow key={activity.id} activity={activity} />
          ))
        ) : (
          <div className="p-12 text-center">
            <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-1">No activities found</h3>
            <p className="text-slate-400">
              {activityType 
                ? `No ${activityType}s match your filters`
                : 'Create your first activity to get started'}
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="glass-card rounded-xl p-4 border border-white/10 flex items-center justify-between">
          <p className="text-sm text-slate-400">
            Showing <span className="text-white font-medium">{((page - 1) * pageSize) + 1}</span> to{' '}
            <span className="text-white font-medium">{Math.min(page * pageSize, total)}</span> of{' '}
            <span className="text-white font-medium">{total.toLocaleString()}</span> results
          </p>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3 rounded-lg bg-slate-900/50 border-white/10 text-slate-300 hover:text-white hover:border-white/20 disabled:opacity-50"
              disabled={page <= 1}
              asChild
            >
              <Link href={`/crm/activities?page=${page - 1}${activityType ? `&type=${activityType}` : ''}`}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Link>
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3 rounded-lg bg-slate-900/50 border-white/10 text-slate-300 hover:text-white hover:border-white/20 disabled:opacity-50"
              disabled={page >= totalPages}
              asChild
            >
              <Link href={`/crm/activities?page=${page + 1}${activityType ? `&type=${activityType}` : ''}`}>
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ActivitiesPage(props: PageProps) {
  return (
    <Suspense fallback={<ActivitiesSkeleton />}>
      <ActivitiesContent {...props} />
    </Suspense>
  );
}

function ActivitiesSkeleton() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-slate-800/50 rounded-xl animate-pulse" />
        <div className="space-y-2">
          <div className="h-7 w-32 bg-slate-800/50 rounded-lg animate-pulse" />
          <div className="h-4 w-24 bg-slate-800/50 rounded animate-pulse" />
        </div>
      </div>
      <div className="h-16 bg-slate-800/30 rounded-2xl animate-pulse border border-white/5" />
      <div className="bg-slate-800/30 rounded-2xl border border-white/5 overflow-hidden">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-20 border-b border-white/5 flex items-center px-4 gap-4 animate-pulse">
            <div className="w-10 h-10 bg-slate-700 rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-48 bg-slate-700 rounded" />
              <div className="h-3 w-32 bg-slate-700 rounded" />
            </div>
            <div className="w-20 h-4 bg-slate-700 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
