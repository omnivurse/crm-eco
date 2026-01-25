'use client';

import { useState, useEffect } from 'react';
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
  AlertCircle,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';

interface ScheduledReport {
  id: string;
  name: string;
  report_name: string;
  cron_expression: string;
  export_format: string;
  recipients: string[];
  is_active: boolean;
  last_run_at?: string;
  next_run_at?: string;
}

function getCronDescription(cron: string): string {
  // Simple cron to human-readable conversion
  const parts = cron.split(' ');
  if (parts.length < 5) return cron;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  if (dayOfMonth === '*' && month === '*') {
    if (dayOfWeek === '*') {
      return `Daily at ${hour}:${minute.padStart(2, '0')}`;
    }
    if (dayOfWeek === '1') {
      return `Every Monday at ${hour}:${minute.padStart(2, '0')}`;
    }
    if (dayOfWeek === '0') {
      return `Every Sunday at ${hour}:${minute.padStart(2, '0')}`;
    }
  }

  if (dayOfMonth === '1' && month === '*' && dayOfWeek === '*') {
    return `Monthly on the 1st at ${hour}:${minute.padStart(2, '0')}`;
  }

  return cron;
}

export default function ScheduledReportsPage() {
  const [schedules, setSchedules] = useState<ScheduledReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Mock data for now - would fetch from API
    setIsLoading(false);
    setSchedules([]);
  }, []);

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    // Would call API to toggle
    setSchedules((prev) =>
      prev.map((s) => (s.id === id ? { ...s, is_active: !currentActive } : s))
    );
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return;
    setSchedules((prev) => prev.filter((s) => s.id !== id));
  };

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

        <div className="flex items-center gap-3">
          <Button className="bg-teal-600 hover:bg-teal-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            New Schedule
          </Button>
        </div>
      </div>

      {/* Coming Soon Banner */}
      <div className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/20 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-violet-500/20">
            <Calendar className="w-6 h-6 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
              Scheduled Reports Coming Soon
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              We're working on automated report scheduling. Soon you'll be able to:
            </p>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Schedule reports to run daily, weekly, or monthly
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Automatically email reports to team members
              </li>
              <li className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Export in CSV, Excel, or PDF formats
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Scheduled Reports List */}
      {schedules.length > 0 ? (
        <div className="space-y-3">
          {schedules.map((schedule) => (
            <div
              key={schedule.id}
              className={`glass-card rounded-xl p-4 border ${
                schedule.is_active
                  ? 'border-emerald-500/20'
                  : 'border-slate-200 dark:border-white/10'
              } transition-all`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                      {schedule.name}
                    </h3>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        schedule.is_active
                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}
                    >
                      {schedule.is_active ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                    {schedule.report_name}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
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
                      {schedule.recipients.length} recipient
                      {schedule.recipients.length !== 1 ? 's' : ''}
                    </span>
                    {schedule.next_run_at && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Next: {new Date(schedule.next_run_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleToggleActive(schedule.id, schedule.is_active)}
                    className={schedule.is_active ? 'text-amber-500' : 'text-emerald-500'}
                  >
                    {schedule.is_active ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </Button>
                  <Button size="sm" variant="ghost">
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-500"
                    onClick={() => handleDelete(schedule.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card rounded-xl p-8 border border-slate-200 dark:border-white/10 text-center">
          <Calendar className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
            No scheduled reports
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-4">
            Create a schedule to automatically run and deliver reports
          </p>
          <Button className="bg-teal-600 hover:bg-teal-700 text-white" disabled>
            <Plus className="w-4 h-4 mr-2" />
            Coming Soon
          </Button>
        </div>
      )}
    </div>
  );
}
