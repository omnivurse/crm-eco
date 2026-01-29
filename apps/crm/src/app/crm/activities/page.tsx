'use client';

import { useState, useEffect, useMemo } from 'react';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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
  Loader2,
  X,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Textarea } from '@crm-eco/ui/components/textarea';
import { Badge } from '@crm-eco/ui/components/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

type ActivityType = 'task' | 'call' | 'meeting' | 'email';

interface Activity {
  id: string;
  title: string;
  description: string | null;
  activity_type: ActivityType;
  status: string;
  priority: string;
  due_at: string | null;
  created_at: string;
  assignee?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
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

function ActivityRow({ activity }: { activity: Activity }) {
  const activityType = (activity.activity_type || 'task') as ActivityType;
  const Icon = ACTIVITY_ICONS[activityType] || ACTIVITY_ICONS.task;
  const colorClass = ACTIVITY_COLORS[activityType] || ACTIVITY_COLORS.task;
  const statusClass = STATUS_COLORS[activity.status] || STATUS_COLORS.open;

  return (
    <div className="flex items-center gap-4 p-4 border-b border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
      <div className={`p-2 rounded-lg ${colorClass}`}>
        {Icon}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-slate-900 dark:text-white truncate">{activity.title}</h3>
          <Badge variant="outline" className={statusClass}>
            {activity.status.replace('_', ' ')}
          </Badge>
        </div>
        <div className="flex items-center gap-3 mt-1 text-sm text-slate-500 dark:text-slate-400">
          <span className="capitalize">{activityType}</span>
          {activity.due_at && (
            <>
              <span>•</span>
              <span className="flex items-center gap-1" suppressHydrationWarning>
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

      <div className="text-sm text-slate-500" suppressHydrationWarning>
        {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
      </div>
    </div>
  );
}

export default function ActivitiesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activityType = searchParams.get('type') || '';
  const statusFilter = searchParams.get('status') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = 25;

  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Live search with debounce
  const { query: searchQuery, setQuery: setSearchQuery, debouncedQuery } = useDebouncedSearch({ delay: 200 });

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    activity_type: 'task' as ActivityType,
    priority: 'normal',
    due_at: '',
  });

  // Fetch activities
  useEffect(() => {
    async function fetchActivities() {
      setLoading(true);
      try {
        let url = '/api/tasks?';
        if (activityType) {
          url += `activity_type=${activityType}&`;
        }
        if (statusFilter) {
          url += `status=${statusFilter}&`;
        }
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setActivities(data);
        }
      } catch (error) {
        console.error('Failed to fetch activities:', error);
        toast.error('Failed to load activities');
      } finally {
        setLoading(false);
      }
    }
    fetchActivities();
  }, [activityType, statusFilter]);

  // Filter and paginate with debounced search
  const filteredActivities = useMemo(() => {
    const searchLower = debouncedQuery.toLowerCase();
    return activities.filter((a) =>
      searchLower
        ? a.title.toLowerCase().includes(searchLower) ||
          a.description?.toLowerCase().includes(searchLower)
        : true
    );
  }, [activities, debouncedQuery]);
  const total = filteredActivities.length;
  const totalPages = Math.ceil(total / pageSize);
  const paginatedActivities = filteredActivities.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  // Get counts by type
  const countByType = activities.reduce((acc, a) => {
    const type = a.activity_type || 'task';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Handle form submission
  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description || undefined,
          priority: formData.priority,
          due_date: formData.due_at || undefined,
          activity_type: formData.activity_type,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create activity');
      }

      const newActivity = await response.json();
      setActivities((prev) => [newActivity, ...prev]);
      toast.success('Activity created successfully');
      setShowModal(false);
      setFormData({
        title: '',
        description: '',
        activity_type: 'task',
        priority: 'normal',
        due_at: '',
      });
    } catch (error) {
      console.error('Error creating activity:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create activity');
    } finally {
      setIsSubmitting(false);
    }
  };

  const buildUrl = (params: Record<string, string | number | undefined>) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        searchParams.set(key, String(value));
      }
    });
    return `/crm/activities${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  };

  if (loading) {
    return <ActivitiesSkeleton />;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500 dark:text-blue-400">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Activities</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-0.5">
              {total.toLocaleString()} {total === 1 ? 'activity' : 'activities'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowModal(true)}
            className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white transition-all"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Activity
          </Button>
        </div>
      </div>

      {/* Toolbar with Filters */}
      <div className="glass-card rounded-2xl p-4 border border-slate-200 dark:border-white/10">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="search"
              placeholder="Search activities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 h-10 rounded-xl bg-white dark:bg-slate-900/50 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/20"
            />
          </div>

          <div className="flex items-center gap-3">
            {/* Activity Type Filters */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10">
              <Link
                href="/crm/activities"
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  !activityType
                    ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5'
                }`}
              >
                All ({activities.length})
              </Link>
              {(['task', 'call', 'meeting', 'email'] as ActivityType[]).map((type) => (
                <Link
                  key={type}
                  href={buildUrl({ type })}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    activityType === type
                      ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5'
                  }`}
                >
                  {ACTIVITY_ICONS[type]}
                  <span className="hidden sm:inline capitalize">{type}s</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    ({countByType[type] || 0})
                  </span>
                </Link>
              ))}
            </div>

            {/* Status Filter */}
            <Button
              variant="outline"
              className="h-10 px-3 rounded-xl bg-white dark:bg-slate-900/50 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/20"
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
          </div>
        </div>
      </div>

      {/* Activities List */}
      <div className="glass-card rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
        {paginatedActivities.length > 0 ? (
          paginatedActivities.map((activity) => (
            <ActivityRow key={activity.id} activity={activity} />
          ))
        ) : (
          <div className="p-12 text-center">
            <Calendar className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">
              No activities found
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              {activityType
                ? `No ${activityType}s match your filters`
                : 'Create your first activity to get started'}
            </p>
            <Button
              onClick={() => setShowModal(true)}
              className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Activity
            </Button>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="glass-card rounded-xl p-4 border border-slate-200 dark:border-white/10 flex items-center justify-between">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Showing{' '}
            <span className="text-slate-900 dark:text-white font-medium">
              {(page - 1) * pageSize + 1}
            </span>{' '}
            to{' '}
            <span className="text-slate-900 dark:text-white font-medium">
              {Math.min(page * pageSize, total)}
            </span>{' '}
            of{' '}
            <span className="text-slate-900 dark:text-white font-medium">
              {total.toLocaleString()}
            </span>{' '}
            results
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3 rounded-lg bg-white dark:bg-slate-900/50 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/20 disabled:opacity-50"
              disabled={page <= 1}
              asChild
            >
              <Link href={buildUrl({ type: activityType, page: page - 1 })}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Link>
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3 rounded-lg bg-white dark:bg-slate-900/50 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/20 disabled:opacity-50"
              disabled={page >= totalPages}
              asChild
            >
              <Link href={buildUrl({ type: activityType, page: page + 1 })}>
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* New Activity Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-white">New Activity</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {/* Activity Type */}
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">
                Activity Type
              </label>
              <Select
                value={formData.activity_type}
                onValueChange={(value: ActivityType) =>
                  setFormData({ ...formData, activity_type: value })
                }
              >
                <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10">
                  <SelectItem value="task">
                    <span className="flex items-center gap-2">
                      <CheckSquare className="w-4 h-4" /> Task
                    </span>
                  </SelectItem>
                  <SelectItem value="call">
                    <span className="flex items-center gap-2">
                      <Phone className="w-4 h-4" /> Call
                    </span>
                  </SelectItem>
                  <SelectItem value="meeting">
                    <span className="flex items-center gap-2">
                      <Users className="w-4 h-4" /> Meeting
                    </span>
                  </SelectItem>
                  <SelectItem value="email">
                    <span className="flex items-center gap-2">
                      <Mail className="w-4 h-4" /> Email
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">
                Title *
              </label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter activity title..."
                className="bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">
                Description
              </label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter description..."
                rows={3}
                className="bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10"
              />
            </div>

            {/* Priority & Due Date */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">
                  Priority
                </label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => setFormData({ ...formData, priority: value })}
                >
                  <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10">
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">
                  Due Date
                </label>
                <Input
                  type="datetime-local"
                  value={formData.due_at}
                  onChange={(e) => setFormData({ ...formData, due_at: e.target.value })}
                  className="bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowModal(false)}
                className="border-slate-200 dark:border-white/10"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="bg-teal-500 hover:bg-teal-600 text-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Activity'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ActivitiesSkeleton() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-slate-200 dark:bg-slate-800/50 rounded-xl animate-pulse" />
        <div className="space-y-2">
          <div className="h-7 w-32 bg-slate-200 dark:bg-slate-800/50 rounded-lg animate-pulse" />
          <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800/50 rounded animate-pulse" />
        </div>
      </div>
      <div className="h-16 bg-slate-100 dark:bg-slate-800/30 rounded-2xl animate-pulse border border-slate-200 dark:border-white/5" />
      <div className="bg-slate-100 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-white/5 overflow-hidden">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="h-20 border-b border-slate-200 dark:border-white/5 flex items-center px-4 gap-4 animate-pulse"
          >
            <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-3 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
            <div className="w-20 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
