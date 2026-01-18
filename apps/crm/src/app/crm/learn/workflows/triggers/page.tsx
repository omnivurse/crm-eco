'use client';

import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import {
  ArrowLeft,
  ArrowRight,
  Zap,
  Clock,
  CheckCircle,
  Plus,
  Edit,
  Trash2,
  Calendar,
  Mail,
  UserPlus,
  Bell,
  Tag,
  RefreshCw,
} from 'lucide-react';
import { AnimatedDemo, StepList, QuickTip } from '@/components/learn/AnimatedDemo';

const DEMO_STEPS = [
  {
    title: 'Select Trigger Type',
    description: 'Choose what event starts your workflow.',
    highlight: { x: 20, y: 25, width: 60, height: 35 },
    cursor: { x: 50, y: 42 },
    duration: 3000,
  },
  {
    title: 'Configure Trigger',
    description: 'Set specific conditions for when to fire.',
    highlight: { x: 20, y: 62, width: 60, height: 20 },
    cursor: { x: 50, y: 72 },
    action: 'click' as const,
    duration: 3000,
  },
  {
    title: 'Add an Action',
    description: 'Click "Add Action" to define what happens.',
    highlight: { x: 20, y: 30, width: 60, height: 8 },
    cursor: { x: 50, y: 34 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Choose Action Type',
    description: 'Select from available actions like send email, update field, etc.',
    highlight: { x: 25, y: 40, width: 50, height: 35 },
    cursor: { x: 50, y: 57 },
    action: 'click' as const,
    duration: 3000,
  },
  {
    title: 'Configure Action',
    description: 'Fill in the details for your action.',
    highlight: { x: 25, y: 45, width: 50, height: 30 },
    cursor: { x: 50, y: 60 },
    duration: 3000,
  },
];

const TRIGGERS = [
  { icon: <Plus className="w-5 h-5" />, name: 'Record Created', description: 'When a new record is added' },
  { icon: <Edit className="w-5 h-5" />, name: 'Record Updated', description: 'When any field changes' },
  { icon: <RefreshCw className="w-5 h-5" />, name: 'Field Changed', description: 'When a specific field changes' },
  { icon: <Trash2 className="w-5 h-5" />, name: 'Record Deleted', description: 'When a record is removed' },
  { icon: <Calendar className="w-5 h-5" />, name: 'Date-based', description: 'On a date field (birthday, renewal)' },
  { icon: <Clock className="w-5 h-5" />, name: 'Scheduled', description: 'At a specific time (daily, weekly)' },
];

const ACTIONS = [
  { icon: <Mail className="w-5 h-5" />, name: 'Send Email', description: 'Send an email from a template' },
  { icon: <Edit className="w-5 h-5" />, name: 'Update Field', description: 'Change a field value' },
  { icon: <Plus className="w-5 h-5" />, name: 'Create Record', description: 'Create a task, note, or related record' },
  { icon: <UserPlus className="w-5 h-5" />, name: 'Assign Owner', description: 'Change the record owner' },
  { icon: <Bell className="w-5 h-5" />, name: 'Send Notification', description: 'Send in-app or Slack notification' },
  { icon: <Tag className="w-5 h-5" />, name: 'Add/Remove Tag', description: 'Manage tags on the record' },
];

export default function TriggersPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/crm/learn" className="text-slate-500 hover:text-teal-600 transition-colors">
          Learning Center
        </Link>
        <span className="text-slate-400">/</span>
        <Link href="/crm/learn/workflows" className="text-slate-500 hover:text-teal-600 transition-colors">
          Workflows
        </Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-900 dark:text-white font-medium">Triggers & Actions</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500">
          <Zap className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Triggers & Actions
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Learn about available triggers and actions to build powerful workflows.
          </p>
          <div className="flex items-center gap-4 mt-4 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              5 min read
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
          title="Setting Triggers and Actions"
          steps={DEMO_STEPS}
        />
      </section>

      {/* Available Triggers */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Available Triggers
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Triggers determine when your workflow runs. Choose one per workflow.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          {TRIGGERS.map((trigger) => (
            <div
              key={trigger.name}
              className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700"
            >
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400">
                {trigger.icon}
              </div>
              <div>
                <h3 className="font-medium text-slate-900 dark:text-white">{trigger.name}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{trigger.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Available Actions */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Available Actions
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Actions are what your workflow does. You can chain multiple actions together.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          {ACTIONS.map((action) => (
            <div
              key={action.name}
              className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700"
            >
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                {action.icon}
              </div>
              <div>
                <h3 className="font-medium text-slate-900 dark:text-white">{action.name}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{action.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Common Combinations */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Popular Trigger + Action Combinations
        </h2>
        <div className="grid gap-4">
          {[
            {
              trigger: 'Lead Created',
              action: 'Assign owner via round-robin',
              use: 'Auto-distribute leads to sales team',
            },
            {
              trigger: 'Deal Stage → Closed Won',
              action: 'Send email + Create onboarding task',
              use: 'Kick off customer success process',
            },
            {
              trigger: 'Contact Birthday (date field)',
              action: 'Send birthday email',
              use: 'Personalized customer outreach',
            },
            {
              trigger: 'Task overdue',
              action: 'Send notification to manager',
              use: 'Escalation alerts',
            },
          ].map((combo) => (
            <div
              key={combo.trigger}
              className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="px-2 py-1 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-medium">
                  Trigger
                </span>
                <span className="text-slate-900 dark:text-white font-medium">{combo.trigger}</span>
              </div>
              <div className="flex items-center gap-3 mb-2">
                <span className="px-2 py-1 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
                  Action
                </span>
                <span className="text-slate-900 dark:text-white font-medium">{combo.action}</span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Use case: {combo.use}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Tips */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Tips for Triggers & Actions
        </h2>
        <div className="space-y-4">
          <QuickTip title="Be Specific with Triggers" type="tip">
            Use "Field Changed" instead of "Record Updated" when you only care about
            specific changes. This prevents unnecessary workflow runs.
          </QuickTip>
          <QuickTip title="Chain Actions Carefully" type="info">
            Actions run in order. If action 2 depends on action 1, make sure
            action 1 completes first. Consider adding delay actions if needed.
          </QuickTip>
          <QuickTip title="Avoid Infinite Loops" type="warning">
            If an action updates a record, and that update triggers the same workflow,
            you'll create an infinite loop. Use conditions to prevent this.
          </QuickTip>
        </div>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-8">
        <Link href="/crm/learn/workflows/creating">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Previous: Creating Workflows
          </Button>
        </Link>
        <Link href="/crm/learn/workflows/testing">
          <Button className="gap-2">
            Next: Testing Workflows
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
