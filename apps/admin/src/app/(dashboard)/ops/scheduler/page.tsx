'use client';

import { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface JobDefinition {
  id: string;
  name: string;
  description: string | null;
  job_type: string;
  schedule_cron: string | null;
  schedule_timezone: string;
  is_active: boolean;
  config: Record<string, any>;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
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
};

const commonSchedules = [
  { label: 'Every hour', cron: '0 * * * *' },
  { label: 'Every day at midnight', cron: '0 0 * * *' },
  { label: 'Every day at 6 AM', cron: '0 6 * * *' },
  { label: 'Every Monday at 9 AM', cron: '0 9 * * 1' },
  { label: 'First of month at midnight', cron: '0 0 1 * *' },
];

export default function SchedulerPage() {
  const [jobs, setJobs] = useState<JobDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<JobDefinition | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    job_type: 'custom',
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

  const openCreateModal = () => {
    setEditingJob(null);
    setFormData({
      name: '',
      description: '',
      job_type: 'custom',
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

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Job Scheduler</h1>
            <p className="text-slate-500">Configure scheduled jobs and automation</p>
          </div>
          <Button onClick={openCreateModal}>
            <Plus className="w-4 h-4 mr-2" />
            New Schedule
          </Button>
        </div>

        {/* Jobs List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : jobs.length === 0 ? (
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
            {jobs.map((job) => (
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
                        </div>
                        <p className="text-sm text-slate-500 mt-1">
                          {jobTypeLabels[job.job_type] || job.job_type}
                        </p>
                        {job.description && (
                          <p className="text-sm text-slate-400 mt-1">{job.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                          {job.schedule_cron && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {job.schedule_cron}
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
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingJob ? 'Edit Schedule' : 'New Schedule'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
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
              <Label>Schedule (Cron Expression)</Label>
              <Input
                value={formData.schedule_cron}
                onChange={(e) => setFormData({ ...formData, schedule_cron: e.target.value })}
                placeholder="0 6 * * *"
                className="mt-1 font-mono"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {commonSchedules.map((s) => (
                  <button
                    key={s.cron}
                    type="button"
                    onClick={() => setFormData({ ...formData, schedule_cron: s.cron })}
                    className="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600"
                  >
                    {s.label}
                  </button>
                ))}
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
                  <SelectItem value="America/New_York">Eastern Time</SelectItem>
                  <SelectItem value="America/Chicago">Central Time</SelectItem>
                  <SelectItem value="America/Denver">Mountain Time</SelectItem>
                  <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
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
