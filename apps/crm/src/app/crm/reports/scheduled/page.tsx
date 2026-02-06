'use client';

/**
 * Scheduled Reports Page
 *
 * Manage automated report schedules:
 * - Create new schedules with cron-based frequency
 * - Send reports via email to team members
 * - Export in CSV, Excel, or PDF formats
 * - Pause/resume/delete schedules
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Plus,
  Play,
  Pause,
  Trash2,
  Edit,
  Mail,
  FileText,
  X,
  Loader2,
  Check,
  FileSpreadsheet,
  Download,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Badge } from '@crm-eco/ui/components/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';
import { toast } from 'sonner';
import { createClient } from '@crm-eco/lib/supabase/client';
import { useClientAuth } from '@/hooks/useClientAuth';

// ============================================================================
// Types
// ============================================================================

interface ScheduledReport {
  id: string;
  name: string;
  report_type: string;
  frequency: string;
  cron_expression: string;
  export_format: string;
  recipients: string[];
  is_active: boolean;
  last_run_at?: string;
  next_run_at?: string;
  created_at: string;
}

type Frequency = 'daily' | 'weekly_monday' | 'weekly_friday' | 'biweekly' | 'monthly_1st' | 'monthly_15th' | 'quarterly';
type ExportFormat = 'csv' | 'xlsx' | 'pdf';
type ReportType = 'pipeline_summary' | 'sales_activity' | 'lead_conversion' | 'revenue_forecast' | 'team_performance' | 'contact_growth';

const FREQUENCY_OPTIONS: Record<Frequency, { label: string; cron: string; description: string }> = {
  daily: { label: 'Daily', cron: '0 8 * * *', description: 'Every day at 8:00 AM' },
  weekly_monday: { label: 'Weekly (Monday)', cron: '0 8 * * 1', description: 'Every Monday at 8:00 AM' },
  weekly_friday: { label: 'Weekly (Friday)', cron: '0 17 * * 5', description: 'Every Friday at 5:00 PM' },
  biweekly: { label: 'Bi-weekly', cron: '0 8 1,15 * *', description: 'Every 1st and 15th at 8:00 AM' },
  monthly_1st: { label: 'Monthly (1st)', cron: '0 8 1 * *', description: '1st of every month at 8:00 AM' },
  monthly_15th: { label: 'Monthly (15th)', cron: '0 8 15 * *', description: '15th of every month at 8:00 AM' },
  quarterly: { label: 'Quarterly', cron: '0 8 1 1,4,7,10 *', description: 'First day of each quarter at 8:00 AM' },
};

const REPORT_TYPES: Record<ReportType, { label: string; description: string }> = {
  pipeline_summary: { label: 'Pipeline Summary', description: 'Deal pipeline overview with stage distribution' },
  sales_activity: { label: 'Sales Activity', description: 'Calls, meetings, emails, and tasks summary' },
  lead_conversion: { label: 'Lead Conversion', description: 'Lead-to-deal conversion rates and funnel' },
  revenue_forecast: { label: 'Revenue Forecast', description: 'Projected revenue by close date' },
  team_performance: { label: 'Team Performance', description: 'Per-rep metrics and leaderboard' },
  contact_growth: { label: 'Contact Growth', description: 'New contacts and engagement trends' },
};

const FORMAT_OPTIONS: Record<ExportFormat, { label: string; icon: React.ReactNode }> = {
  csv: { label: 'CSV', icon: <FileText className="w-4 h-4" /> },
  xlsx: { label: 'Excel', icon: <FileSpreadsheet className="w-4 h-4" /> },
  pdf: { label: 'PDF', icon: <Download className="w-4 h-4" /> },
};

// ============================================================================
// Helpers
// ============================================================================

function getCronDescription(cron: string): string {
  for (const opt of Object.values(FREQUENCY_OPTIONS)) {
    if (opt.cron === cron) return opt.description;
  }
  const parts = cron.split(' ');
  if (parts.length < 5) return cron;
  const [minute, hour, dayOfMonth, , dayOfWeek] = parts;
  if (dayOfMonth === '*' && dayOfWeek === '*') return `Daily at ${hour}:${minute.padStart(2, '0')}`;
  if (dayOfMonth === '*' && dayOfWeek === '1') return `Every Monday at ${hour}:${minute.padStart(2, '0')}`;
  if (dayOfMonth === '1' && dayOfWeek === '*') return `Monthly on the 1st at ${hour}:${minute.padStart(2, '0')}`;
  return cron;
}

function calculateNextRun(cron: string): string {
  // Simple next-run approximation
  const now = new Date();
  const parts = cron.split(' ');
  if (parts.length < 5) return now.toISOString();
  const [, hour] = parts;
  const next = new Date(now);
  next.setHours(parseInt(hour) || 8, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.toISOString();
}

// ============================================================================
// Main Page
// ============================================================================

export default function ScheduledReportsPage() {
  const supabase = createClient();
  const { profile, loading: authLoading } = useClientAuth();
  const [schedules, setSchedules] = useState<ScheduledReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduledReport | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formReportType, setFormReportType] = useState<ReportType>('pipeline_summary');
  const [formFrequency, setFormFrequency] = useState<Frequency>('weekly_monday');
  const [formFormat, setFormFormat] = useState<ExportFormat>('csv');
  const [formRecipients, setFormRecipients] = useState('');

  /**
   * Typed helper for scheduled_reports table.
   * This table exists in the DB but isn't in the generated Supabase types yet.
   * TODO: Remove 'as any' casts after running `npm run db:generate-types`
   */
  /** TODO: Remove type bypass after running `npm run db:generate-types` */
  const scheduledReports = useCallback(
    () => (supabase as Record<string, any>).from('scheduled_reports'),
    [supabase]
  );

  // ========================================================================
  // Data Loading
  // ========================================================================

  const loadSchedules = useCallback(async () => {
    if (!profile?.organization_id) return;

    try {
      const { data } = await scheduledReports()
        .select('*')
        .eq('org_id', profile.organization_id)
        .order('created_at', { ascending: false });

      setSchedules((data || []) as ScheduledReport[]);
    } catch (error) {
      console.error('Failed to load schedules:', error);
      // Use empty array if table doesn't exist yet
      setSchedules([]);
    } finally {
      setIsLoading(false);
    }
  }, [profile, scheduledReports]);

  useEffect(() => {
    if (!authLoading) {
      loadSchedules();
    }
  }, [authLoading, loadSchedules]);

  // ========================================================================
  // Actions
  // ========================================================================

  function resetForm() {
    setFormName('');
    setFormReportType('pipeline_summary');
    setFormFrequency('weekly_monday');
    setFormFormat('csv');
    setFormRecipients('');
    setEditingSchedule(null);
  }

  function openCreate() {
    resetForm();
    setShowCreateDialog(true);
  }

  function openEdit(schedule: ScheduledReport) {
    setEditingSchedule(schedule);
    setFormName(schedule.name);
    setFormReportType(schedule.report_type as ReportType);
    setFormFormat(schedule.export_format as ExportFormat);
    setFormRecipients(schedule.recipients.join(', '));
    // Find matching frequency
    const matchedFreq = Object.entries(FREQUENCY_OPTIONS).find(
      ([, opt]) => opt.cron === schedule.cron_expression
    );
    setFormFrequency((matchedFreq?.[0] as Frequency) || 'weekly_monday');
    setShowCreateDialog(true);
  }

  async function handleSaveSchedule() {
    if (!formName.trim()) {
      toast.error('Please enter a schedule name');
      return;
    }
    const recipients = formRecipients
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);
    if (recipients.length === 0) {
      toast.error('Please add at least one recipient email');
      return;
    }

    setSaving(true);
    try {
      if (!profile?.organization_id) throw new Error('Not authenticated');

      const cronExp = FREQUENCY_OPTIONS[formFrequency].cron;
      const payload = {
        org_id: profile.organization_id,
        name: formName.trim(),
        report_type: formReportType,
        frequency: formFrequency,
        cron_expression: cronExp,
        export_format: formFormat,
        recipients,
        is_active: true,
        next_run_at: calculateNextRun(cronExp),
      };

      if (editingSchedule) {
        const { error } = await scheduledReports()
          .update(payload)
          .eq('id', editingSchedule.id);
        if (error) throw error;
        toast.success('Schedule updated');
      } else {
        const { error } = await scheduledReports()
          .insert(payload);
        if (error) throw error;
        toast.success('Schedule created');
      }

      setShowCreateDialog(false);
      resetForm();
      loadSchedules();
    } catch (error) {
      console.error('Failed to save schedule:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save schedule');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(id: string, currentActive: boolean) {
    try {
      const { error } = await scheduledReports()
        .update({ is_active: !currentActive })
        .eq('id', id);

      if (error) throw error;

      setSchedules((prev) =>
        prev.map((s) => (s.id === id ? { ...s, is_active: !currentActive } : s))
      );
      toast.success(currentActive ? 'Schedule paused' : 'Schedule resumed');
    } catch {
      toast.error('Failed to update schedule');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this schedule?')) return;

    try {
      const { error } = await scheduledReports()
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSchedules((prev) => prev.filter((s) => s.id !== id));
      toast.success('Schedule deleted');
    } catch {
      toast.error('Failed to delete schedule');
    }
  }

  // ========================================================================
  // Render
  // ========================================================================

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <Link
            href="/crm/reports"
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Reports
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Scheduled Reports
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-0.5">
            Automate report delivery on a schedule
          </p>
        </div>
        <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          New Schedule
        </Button>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-500/10">
              <Calendar className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{schedules.length}</p>
              <p className="text-xs text-slate-500">Total Schedules</p>
            </div>
          </div>
        </div>
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <Play className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{schedules.filter((s) => s.is_active).length}</p>
              <p className="text-xs text-slate-500">Active</p>
            </div>
          </div>
        </div>
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Pause className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{schedules.filter((s) => !s.is_active).length}</p>
              <p className="text-xs text-slate-500">Paused</p>
            </div>
          </div>
        </div>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
        </div>
      ) : schedules.length > 0 ? (
        /* Schedules List */
        <div className="space-y-3">
          {schedules.map((schedule) => (
            <div
              key={schedule.id}
              className={`glass-card rounded-xl p-5 border transition-all ${
                schedule.is_active
                  ? 'border-emerald-500/20 hover:border-emerald-500/40'
                  : 'border-slate-200 dark:border-white/10 opacity-75'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                      {schedule.name}
                    </h3>
                    <Badge
                      variant={schedule.is_active ? 'default' : 'secondary'}
                      className={
                        schedule.is_active
                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                          : ''
                      }
                    >
                      {schedule.is_active ? 'Active' : 'Paused'}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                    {REPORT_TYPES[schedule.report_type as ReportType]?.label || schedule.report_type}
                  </p>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {getCronDescription(schedule.cron_expression)}
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {schedule.export_format.toUpperCase()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {schedule.recipients.length} recipient{schedule.recipients.length !== 1 ? 's' : ''}
                    </span>
                    {schedule.next_run_at && schedule.is_active && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Next: {new Date(schedule.next_run_at).toLocaleDateString()}
                      </span>
                    )}
                    {schedule.last_run_at && (
                      <span className="flex items-center gap-1 text-emerald-500">
                        <Check className="w-3 h-3" />
                        Last: {new Date(schedule.last_run_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 ml-4">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleToggleActive(schedule.id, schedule.is_active)}
                    className={schedule.is_active ? 'text-amber-500 hover:text-amber-600' : 'text-emerald-500 hover:text-emerald-600'}
                    title={schedule.is_active ? 'Pause' : 'Resume'}
                  >
                    {schedule.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(schedule)} title="Edit">
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-500 hover:text-red-600"
                    onClick={() => handleDelete(schedule.id)}
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="glass-card rounded-xl p-12 border border-slate-200 dark:border-white/10 text-center">
          <Calendar className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
            No scheduled reports yet
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
            Automate your reporting by creating a schedule. Reports will be generated
            and emailed to your team on the cadence you choose.
          </p>
          <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Schedule
          </Button>
        </div>
      )}

      {/* ================================================================ */}
      {/* Create / Edit Dialog */}
      {/* ================================================================ */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => { if (!open) { setShowCreateDialog(false); resetForm(); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-teal-500" />
              {editingSchedule ? 'Edit Schedule' : 'New Report Schedule'}
            </DialogTitle>
            <DialogDescription>
              {editingSchedule
                ? 'Update the settings for this scheduled report.'
                : 'Set up a new automated report to be generated and emailed on a recurring schedule.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Schedule Name
              </label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Weekly Pipeline Report"
              />
            </div>

            {/* Report Type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Report Type
              </label>
              <Select value={formReportType} onValueChange={(v) => setFormReportType(v as ReportType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(REPORT_TYPES).map(([key, info]) => (
                    <SelectItem key={key} value={key}>
                      <div>
                        <span>{info.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">
                {REPORT_TYPES[formReportType].description}
              </p>
            </div>

            {/* Frequency */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Frequency
              </label>
              <Select value={formFrequency} onValueChange={(v) => setFormFrequency(v as Frequency)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FREQUENCY_OPTIONS).map(([key, opt]) => (
                    <SelectItem key={key} value={key}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">
                {FREQUENCY_OPTIONS[formFrequency].description}
              </p>
            </div>

            {/* Export Format */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Export Format
              </label>
              <div className="flex gap-2">
                {(Object.entries(FORMAT_OPTIONS) as [ExportFormat, { label: string; icon: React.ReactNode }][]).map(
                  ([key, opt]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFormFormat(key)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        formFormat === key
                          ? 'bg-teal-50 dark:bg-teal-500/10 border-teal-500 text-teal-700 dark:text-teal-400'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      {opt.icon}
                      {opt.label}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Recipients */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Recipients (comma-separated emails)
              </label>
              <Input
                value={formRecipients}
                onChange={(e) => setFormRecipients(e.target.value)}
                placeholder="john@company.com, jane@company.com"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm(); }}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveSchedule}
              disabled={saving}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : editingSchedule ? (
                <Check className="w-4 h-4 mr-2" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              {editingSchedule ? 'Update Schedule' : 'Create Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
