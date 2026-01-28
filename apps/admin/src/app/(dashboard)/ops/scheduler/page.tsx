'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@crm-eco/lib/supabase/client';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Label,
  Textarea,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@crm-eco/ui';
import {
  Plus,
  Calendar,
  Clock,
  Play,
  Pause,
  Pencil,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  List,
  Grid3X3,
  Info,
} from 'lucide-react';
import { format, formatDistanceToNow, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths, isSameDay, getDay, startOfWeek, endOfWeek } from 'date-fns';
import { toast } from 'sonner';

interface JobDefinition {
  id: string;
  name: string;
  description: string | null;
  job_type: string;
  vendor_code: string | null;
  schedule_cron: string | null;
  schedule_timezone: string;
  is_active: boolean;
  config: Record<string, any>;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
}

interface ScheduledEvent {
  id: string;
  name: string;
  job_type: string;
  date: Date;
  time: string;
  color: string;
}

const jobTypeLabels: Record<string, string> = {
  eligibility_check: 'Eligibility Check',
  billing_run: 'Billing Run',
  commission_calculation: 'Commission Calculation',
  nacha_export: 'NACHA Export',
  nacha_import: 'NACHA Import',
  member_import: 'Member Import',
  agent_import: 'Agent Import',
  report_generation: 'Report Generation',
  data_sync: 'Data Sync',
  cleanup: 'Data Cleanup',
  custom: 'Custom Job',
  vendor_eligibility: 'Vendor Eligibility',
  vendor_enrollment_sync: 'Enrollment Sync',
  vendor_termination_sync: 'Termination Sync',
  vendor_roster_pull: 'Roster Pull',
  age_up_out_check: 'Age Up/Out Check',
};

const jobTypeColors: Record<string, string> = {
  eligibility_check: 'bg-blue-500',
  billing_run: 'bg-emerald-500',
  commission_calculation: 'bg-purple-500',
  nacha_export: 'bg-amber-500',
  nacha_import: 'bg-amber-500',
  member_import: 'bg-pink-500',
  agent_import: 'bg-pink-500',
  report_generation: 'bg-cyan-500',
  data_sync: 'bg-indigo-500',
  cleanup: 'bg-slate-500',
  custom: 'bg-slate-500',
  vendor_eligibility: 'bg-blue-500',
  vendor_enrollment_sync: 'bg-teal-500',
  vendor_termination_sync: 'bg-red-500',
  vendor_roster_pull: 'bg-orange-500',
  age_up_out_check: 'bg-violet-500',
};

const commonSchedules = [
  { label: 'Every hour', cron: '0 * * * *', description: 'At minute 0 of every hour' },
  { label: 'Every 6 hours', cron: '0 */6 * * *', description: 'At minute 0, every 6 hours' },
  { label: 'Daily at midnight', cron: '0 0 * * *', description: '12:00 AM every day' },
  { label: 'Daily at 6 AM', cron: '0 6 * * *', description: '6:00 AM every day' },
  { label: 'Daily at 9 AM', cron: '0 9 * * *', description: '9:00 AM every day' },
  { label: 'Weekdays at 9 AM', cron: '0 9 * * 1-5', description: '9:00 AM Monday to Friday' },
  { label: 'Every Monday at 9 AM', cron: '0 9 * * 1', description: '9:00 AM every Monday' },
  { label: 'First of month', cron: '0 0 1 * *', description: 'Midnight on 1st of each month' },
  { label: 'Last day of month', cron: '0 0 L * *', description: 'Midnight on last day of month' },
];

// Simple cron parser for display purposes
function parseCronExpression(cron: string): { description: string; nextRuns: Date[] } {
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) {
    return { description: 'Invalid cron expression', nextRuns: [] };
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  let description = '';

  // Build simple description
  if (minute === '0' && hour === '*') {
    description = 'Every hour at :00';
  } else if (minute === '0' && hour.includes('/')) {
    const interval = hour.split('/')[1];
    description = `Every ${interval} hours`;
  } else if (minute === '0' && /^\d+$/.test(hour)) {
    const hourNum = parseInt(hour);
    const ampm = hourNum >= 12 ? 'PM' : 'AM';
    const displayHour = hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum;

    if (dayOfWeek === '1-5') {
      description = `Weekdays at ${displayHour}:00 ${ampm}`;
    } else if (dayOfWeek === '*' && dayOfMonth === '*') {
      description = `Daily at ${displayHour}:00 ${ampm}`;
    } else if (dayOfMonth === '1') {
      description = `1st of month at ${displayHour}:00 ${ampm}`;
    } else if (/^\d$/.test(dayOfWeek)) {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      description = `Every ${days[parseInt(dayOfWeek)]} at ${displayHour}:00 ${ampm}`;
    } else {
      description = `At ${displayHour}:00 ${ampm}`;
    }
  } else {
    description = `${minute} ${hour} ${dayOfMonth} ${month} ${dayOfWeek}`;
  }

  // Generate next 5 runs (simplified)
  const nextRuns: Date[] = [];
  const now = new Date();

  // This is a simplified next run calculation
  if (minute === '0' && /^\d+$/.test(hour)) {
    const targetHour = parseInt(hour);
    let date = new Date(now);
    date.setMinutes(0, 0, 0);
    date.setHours(targetHour);

    if (date <= now) {
      date.setDate(date.getDate() + 1);
    }

    for (let i = 0; i < 5; i++) {
      nextRuns.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
  }

  return { description, nextRuns };
}

export default function SchedulerPage() {
  const [jobs, setJobs] = useState<JobDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<JobDefinition | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    job_type: 'custom',
    vendor_code: '',
    schedule_cron: '',
    schedule_timezone: 'America/New_York',
    is_active: true,
  });

  const supabase = createClient();

  const fetchJobs = useCallback(async () => {
    if (!organizationId) return;

    try {
      const { data, error } = await supabase
        .from('job_definitions')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name');

      if (error) {
        if (error.code === '42P01') {
          setJobs([]);
          return;
        }
        throw error;
      }

      setJobs(data || []);
    } catch (error) {
      console.error('Error fetching job definitions:', error);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, organizationId]);

  useEffect(() => {
    async function getOrgId() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, organization_id')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        setOrganizationId(profile.organization_id);
        setProfileId(profile.id);
      }
    }

    getOrgId();
  }, [supabase]);

  useEffect(() => {
    if (organizationId) {
      fetchJobs();
    }
  }, [organizationId, fetchJobs]);

  // Generate calendar events from jobs
  const calendarEvents = useMemo(() => {
    const events: ScheduledEvent[] = [];
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    jobs.filter(j => j.is_active && j.schedule_cron).forEach(job => {
      const { nextRuns } = parseCronExpression(job.schedule_cron!);
      nextRuns.forEach(runDate => {
        if (runDate >= monthStart && runDate <= monthEnd) {
          events.push({
            id: `${job.id}-${runDate.getTime()}`,
            name: job.name,
            job_type: job.job_type,
            date: runDate,
            time: format(runDate, 'h:mm a'),
            color: jobTypeColors[job.job_type] || 'bg-slate-500',
          });
        }
      });
    });

    return events;
  }, [jobs, currentMonth]);

  // Calendar days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentMonth]);

  const openCreateModal = () => {
    setEditingJob(null);
    setFormData({
      name: '',
      description: '',
      job_type: 'custom',
      vendor_code: '',
      schedule_cron: '',
      schedule_timezone: 'America/New_York',
      is_active: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (job: JobDefinition) => {
    setEditingJob(job);
    setFormData({
      name: job.name,
      description: job.description || '',
      job_type: job.job_type,
      vendor_code: job.vendor_code || '',
      schedule_cron: job.schedule_cron || '',
      schedule_timezone: job.schedule_timezone,
      is_active: job.is_active,
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }

    setSaving(true);
    try {
      const jobData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        job_type: formData.job_type,
        vendor_code: formData.vendor_code || null,
        schedule_cron: formData.schedule_cron.trim() || null,
        schedule_timezone: formData.schedule_timezone,
        is_active: formData.is_active,
      };

      if (editingJob) {
        const { error } = await supabase
          .from('job_definitions')
          .update(jobData)
          .eq('id', editingJob.id);

        if (error) throw error;
        toast.success('Schedule updated');
      } else {
        const { error } = await supabase
          .from('job_definitions')
          .insert({
            ...jobData,
            organization_id: organizationId,
            created_by: profileId,
            config: {},
          });

        if (error) throw error;
        toast.success('Schedule created');
      }

      setIsModalOpen(false);
      fetchJobs();
    } catch (error: any) {
      console.error('Error saving job:', error);
      toast.error(error.message || 'Failed to save schedule');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (job: JobDefinition) => {
    try {
      const { error } = await supabase
        .from('job_definitions')
        .update({ is_active: !job.is_active })
        .eq('id', job.id);

      if (error) throw error;

      toast.success(job.is_active ? 'Schedule paused' : 'Schedule activated');
      fetchJobs();
    } catch (error: any) {
      toast.error('Failed to update schedule');
    }
  };

  const handleDelete = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('job_definitions')
        .delete()
        .eq('id', jobId);

      if (error) throw error;

      toast.success('Schedule deleted');
      setIsModalOpen(false);
      fetchJobs();
    } catch (error: any) {
      toast.error('Failed to delete schedule');
    }
  };

  const runJobNow = async (job: JobDefinition) => {
    try {
      const { error } = await supabase
        .from('job_runs')
        .insert({
          organization_id: organizationId,
          job_definition_id: job.id,
          job_type: job.job_type,
          job_name: job.name,
          vendor_code: job.vendor_code,
          status: 'pending',
          trigger_type: 'manual',
          triggered_by: profileId,
        });

      if (error) throw error;

      toast.success('Job queued for execution');
    } catch (error: any) {
      toast.error('Failed to run job');
    }
  };

  const cronInfo = formData.schedule_cron ? parseCronExpression(formData.schedule_cron) : null;

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Job Scheduler</h1>
            <p className="text-slate-500">Configure scheduled jobs and automation</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center border rounded-lg p-1">
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`p-2 rounded ${viewMode === 'calendar' ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
            </div>
            <Button onClick={openCreateModal}>
              <Plus className="w-4 h-4 mr-2" />
              New Schedule
            </Button>
          </div>
        </div>

        {/* View Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : viewMode === 'list' ? (
          // List View
          jobs.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <Calendar className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-500">No scheduled jobs yet</p>
                  <p className="text-sm text-slate-400 mb-4">Create a schedule to automate recurring tasks</p>
                  <Button onClick={openCreateModal}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Schedule
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {jobs.map((job) => {
                const cronParsed = job.schedule_cron ? parseCronExpression(job.schedule_cron) : null;

                return (
                  <Card key={job.id} className={!job.is_active ? 'opacity-60' : ''}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className={`p-3 rounded-xl ${job.is_active ? 'bg-purple-100' : 'bg-slate-100'}`}>
                            <Calendar className={`w-5 h-5 ${job.is_active ? 'text-purple-600' : 'text-slate-400'}`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-slate-900">{job.name}</h3>
                              <Badge variant={job.is_active ? 'default' : 'secondary'}>
                                {job.is_active ? 'Active' : 'Paused'}
                              </Badge>
                              {job.vendor_code && (
                                <Badge variant="outline">{job.vendor_code.toUpperCase()}</Badge>
                              )}
                            </div>
                            <p className="text-sm text-slate-500 mt-1">
                              {jobTypeLabels[job.job_type] || job.job_type}
                            </p>
                            {job.description && (
                              <p className="text-sm text-slate-400 mt-1">{job.description}</p>
                            )}
                            <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                              {job.schedule_cron && cronParsed && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {cronParsed.description}
                                </span>
                              )}
                              {job.last_run_at && (
                                <span>
                                  Last run: {formatDistanceToNow(new Date(job.last_run_at), { addSuffix: true })}
                                </span>
                              )}
                              {job.next_run_at && job.is_active && (
                                <span className="text-purple-600">
                                  Next: {formatDistanceToNow(new Date(job.next_run_at), { addSuffix: true })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => runJobNow(job)}
                          >
                            <Play className="w-4 h-4 mr-1" />
                            Run Now
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleActive(job)}
                          >
                            {job.is_active ? (
                              <Pause className="w-4 h-4" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(job)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )
        ) : (
          // Calendar View
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <h2 className="text-lg font-semibold">
                    {format(currentMonth, 'MMMM yyyy')}
                  </h2>
                  <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
                <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>
                  Today
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-lg overflow-hidden">
                {/* Day headers */}
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="bg-slate-50 p-2 text-center text-sm font-medium text-slate-500">
                    {day}
                  </div>
                ))}

                {/* Calendar days */}
                {calendarDays.map((day) => {
                  const dayEvents = calendarEvents.filter(e => isSameDay(e.date, day));
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isSelected = selectedDate && isSameDay(day, selectedDate);

                  return (
                    <div
                      key={day.toISOString()}
                      className={`
                        min-h-[100px] bg-white p-2 cursor-pointer transition-colors
                        ${!isCurrentMonth ? 'bg-slate-50' : ''}
                        ${isToday(day) ? 'ring-2 ring-inset ring-purple-500' : ''}
                        ${isSelected ? 'bg-purple-50' : 'hover:bg-slate-50'}
                      `}
                      onClick={() => setSelectedDate(day)}
                    >
                      <div className={`
                        text-sm font-medium mb-1
                        ${!isCurrentMonth ? 'text-slate-400' : isToday(day) ? 'text-purple-600' : 'text-slate-700'}
                      `}>
                        {format(day, 'd')}
                      </div>
                      <div className="space-y-1">
                        {dayEvents.slice(0, 3).map((event) => (
                          <div
                            key={event.id}
                            className={`text-xs px-1.5 py-0.5 rounded truncate text-white ${event.color}`}
                            title={`${event.name} at ${event.time}`}
                          >
                            {event.time} {event.name}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-xs text-slate-400 px-1">
                            +{dayEvents.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Selected day events */}
              {selectedDate && (
                <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                  <h3 className="font-semibold text-slate-900 mb-3">
                    {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                  </h3>
                  {calendarEvents.filter(e => isSameDay(e.date, selectedDate)).length === 0 ? (
                    <p className="text-sm text-slate-500">No scheduled jobs for this day</p>
                  ) : (
                    <div className="space-y-2">
                      {calendarEvents.filter(e => isSameDay(e.date, selectedDate)).map((event) => (
                        <div key={event.id} className="flex items-center gap-3 p-2 bg-white rounded border">
                          <div className={`w-3 h-3 rounded-full ${event.color}`} />
                          <div>
                            <p className="font-medium text-slate-700">{event.name}</p>
                            <p className="text-xs text-slate-400">
                              {event.time} • {jobTypeLabels[event.job_type]}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Legend */}
        {viewMode === 'calendar' && jobs.length > 0 && (
          <Card>
            <CardContent className="py-4">
              <p className="text-sm font-medium text-slate-700 mb-3">Job Types</p>
              <div className="flex flex-wrap gap-3">
                {Object.entries(jobTypeLabels)
                  .filter(([type]) => jobs.some(j => j.job_type === type))
                  .map(([type, label]) => (
                    <div key={type} className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${jobTypeColors[type]}`} />
                      <span className="text-sm text-slate-600">{label}</span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingJob ? 'Edit Schedule' : 'New Schedule'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div>
              <Label>Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Daily Eligibility Check"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="What this scheduled job does..."
                className="mt-1"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Job Type</Label>
                <Select
                  value={formData.job_type}
                  onValueChange={(v) => setFormData({ ...formData, job_type: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(jobTypeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Vendor (optional)</Label>
                <Select
                  value={formData.vendor_code}
                  onValueChange={(v) => setFormData({ ...formData, vendor_code: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select vendor..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    <SelectItem value="arm">ARM</SelectItem>
                    <SelectItem value="sedera">Sedera</SelectItem>
                    <SelectItem value="zion">Zion</SelectItem>
                    <SelectItem value="mphc">MPHC</SelectItem>
                    <SelectItem value="altrua">Altrua</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Schedule (Cron Expression)</Label>
              <Input
                value={formData.schedule_cron}
                onChange={(e) => setFormData({ ...formData, schedule_cron: e.target.value })}
                placeholder="0 6 * * *"
                className="mt-1 font-mono"
              />

              {/* Cron helper */}
              {cronInfo && formData.schedule_cron && (
                <div className="mt-2 p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2 text-sm">
                    <Info className="w-4 h-4 text-blue-500" />
                    <span className="font-medium text-slate-700">{cronInfo.description}</span>
                  </div>
                  {cronInfo.nextRuns.length > 0 && (
                    <div className="mt-2 text-xs text-slate-500">
                      Next runs: {cronInfo.nextRuns.slice(0, 3).map(d => format(d, 'MMM d, h:mm a')).join(' • ')}
                    </div>
                  )}
                </div>
              )}

              {/* Quick schedule buttons */}
              <div className="mt-3">
                <p className="text-xs text-slate-500 mb-2">Quick schedules:</p>
                <div className="flex flex-wrap gap-2">
                  {commonSchedules.map((s) => (
                    <button
                      key={s.cron}
                      type="button"
                      onClick={() => setFormData({ ...formData, schedule_cron: s.cron })}
                      className={`text-xs px-2 py-1 rounded transition-colors ${
                        formData.schedule_cron === s.cron
                          ? 'bg-purple-100 text-purple-700 border border-purple-300'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }`}
                      title={s.description}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <Label>Timezone</Label>
              <Select
                value={formData.schedule_timezone}
                onValueChange={(v) => setFormData({ ...formData, schedule_timezone: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                  <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                  <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                  <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                  <SelectItem value="America/Anchorage">Alaska Time (AKT)</SelectItem>
                  <SelectItem value="Pacific/Honolulu">Hawaii Time (HT)</SelectItem>
                  <SelectItem value="UTC">UTC</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Active</Label>
            </div>
          </div>

          <DialogFooter className="flex justify-between">
            <div>
              {editingJob && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => handleDelete(editingJob.id)}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingJob ? 'Update' : 'Create'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
