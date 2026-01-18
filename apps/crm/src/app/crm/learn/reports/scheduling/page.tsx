'use client';

import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Clock,
  CheckCircle,
  Mail,
  Repeat,
  Users,
  FileText,
  Bell,
} from 'lucide-react';
import { AnimatedDemo, StepList, QuickTip } from '@/components/learn/AnimatedDemo';

const DEMO_STEPS = [
  {
    title: 'Open a Report',
    description: 'Go to Reports and click on the report you want to schedule.',
    cursor: { x: 50, y: 40 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Click Schedule',
    description: 'Click the "Schedule" button in the report toolbar.',
    highlight: { x: 70, y: 10, width: 15, height: 5 },
    cursor: { x: 77, y: 12 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Set Frequency',
    description: 'Choose how often to send: daily, weekly, or monthly.',
    highlight: { x: 25, y: 30, width: 50, height: 15 },
    cursor: { x: 50, y: 37 },
    action: 'click' as const,
    duration: 3000,
  },
  {
    title: 'Choose Time',
    description: 'Select what time of day to generate and send.',
    highlight: { x: 25, y: 48, width: 50, height: 12 },
    cursor: { x: 50, y: 54 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Add Recipients',
    description: 'Enter email addresses of people who should receive it.',
    highlight: { x: 25, y: 62, width: 50, height: 15 },
    cursor: { x: 50, y: 69 },
    action: 'click' as const,
    duration: 3000,
  },
  {
    title: 'Activate Schedule',
    description: 'Click "Save Schedule" to activate.',
    highlight: { x: 60, y: 80, width: 20, height: 5 },
    cursor: { x: 70, y: 82 },
    action: 'click' as const,
    duration: 2500,
  },
];

export default function SchedulingPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/crm/learn" className="text-slate-500 hover:text-teal-600 transition-colors">
          Learning Center
        </Link>
        <span className="text-slate-400">/</span>
        <Link href="/crm/learn/reports" className="text-slate-500 hover:text-teal-600 transition-colors">
          Reports
        </Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-900 dark:text-white font-medium">Scheduling Reports</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500">
          <Calendar className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Scheduling Reports
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Automatically deliver reports to stakeholders on a regular schedule.
          </p>
          <div className="flex items-center gap-4 mt-4 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              4 min read
            </span>
          </div>
        </div>
      </div>

      {/* Video Demo */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Interactive Demo
        </h2>
        <AnimatedDemo
          title="Scheduling a Report"
          steps={DEMO_STEPS}
        />
      </section>

      {/* Schedule Options */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Schedule Options
        </h2>
        <div className="grid gap-4">
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <Repeat className="w-5 h-5 text-emerald-500" />
              <h3 className="font-semibold text-slate-900 dark:text-white">Frequency</h3>
            </div>
            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
              <li><strong>Daily:</strong> Every day at the specified time</li>
              <li><strong>Weekly:</strong> Same day each week (e.g., every Monday)</li>
              <li><strong>Monthly:</strong> Same date each month (e.g., 1st of month)</li>
            </ul>
          </div>
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-5 h-5 text-blue-500" />
              <h3 className="font-semibold text-slate-900 dark:text-white">Delivery Time</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Choose what time of day to send. Reports are generated fresh at send time,
              so data is always current. Consider your recipients' time zones.
            </p>
          </div>
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="w-5 h-5 text-violet-500" />
              <h3 className="font-semibold text-slate-900 dark:text-white">Format</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Reports are delivered as email attachments. Choose PDF for formatted
              reports with charts, or CSV for raw data that opens in Excel.
            </p>
          </div>
        </div>
      </section>

      {/* Step by Step */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          How to Schedule a Report
        </h2>
        <StepList
          steps={[
            {
              title: 'Open the Report',
              description: 'Navigate to the report you want to schedule.',
            },
            {
              title: 'Click Schedule',
              description: 'Click the "Schedule" button in the top toolbar.',
            },
            {
              title: 'Choose Frequency',
              description: 'Select daily, weekly, or monthly delivery.',
            },
            {
              title: 'Set the Time',
              description: 'Pick the time of day for delivery.',
            },
            {
              title: 'Add Recipients',
              description: 'Enter email addresses. Can include people outside your org.',
            },
            {
              title: 'Choose Format',
              description: 'Select PDF (formatted) or CSV (spreadsheet).',
            },
            {
              title: 'Save and Activate',
              description: 'Save the schedule. It starts from the next scheduled time.',
            },
          ]}
        />
      </section>

      {/* Managing Schedules */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Managing Scheduled Reports
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          View and manage all scheduled reports in Settings → Reports → Scheduled Reports.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { icon: <Bell className="w-5 h-5" />, action: 'Pause/Resume', description: 'Temporarily stop without deleting' },
            { icon: <Mail className="w-5 h-5" />, action: 'Edit Recipients', description: 'Add or remove email addresses' },
            { icon: <Clock className="w-5 h-5" />, action: 'Change Schedule', description: 'Modify frequency or time' },
            { icon: <Users className="w-5 h-5" />, action: 'Send Now', description: 'Trigger an immediate send' },
          ].map((item) => (
            <div
              key={item.action}
              className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700"
            >
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                {item.icon}
              </div>
              <div>
                <h3 className="font-medium text-slate-900 dark:text-white">{item.action}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Tips */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Scheduling Tips
        </h2>
        <div className="space-y-4">
          <QuickTip title="Consider Time Zones" type="tip">
            Schedule reports to arrive in the morning of your recipients' time zone.
            A report at 8am is more useful than one at 2am.
          </QuickTip>
          <QuickTip title="Weekly for Most Teams" type="info">
            Weekly reports are often the right cadence. Daily can be too much noise;
            monthly may miss timely insights.
          </QuickTip>
          <QuickTip title="Include Context" type="info">
            Add a custom message in the email explaining what the report shows
            and what actions recipients should consider.
          </QuickTip>
        </div>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-8">
        <Link href="/crm/learn/reports/custom">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Previous: Custom Reports
          </Button>
        </Link>
        <Link href="/crm/learn/reports/exporting">
          <Button className="gap-2">
            Next: Exporting Data
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
