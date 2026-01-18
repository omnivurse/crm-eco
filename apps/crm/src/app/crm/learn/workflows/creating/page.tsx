'use client';

import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import {
  ArrowLeft,
  ArrowRight,
  Wrench,
  Clock,
  CheckCircle,
  Plus,
  Play,
  Settings,
  GitBranch,
  Zap,
} from 'lucide-react';
import { AnimatedDemo, StepList, QuickTip } from '@/components/learn/AnimatedDemo';

const DEMO_STEPS = [
  {
    title: 'Go to Automations',
    description: 'Navigate to Settings → Automations → Workflows.',
    cursor: { x: 15, y: 45 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Create New Workflow',
    description: 'Click "Create Workflow" to start building.',
    highlight: { x: 70, y: 15, width: 18, height: 5 },
    cursor: { x: 79, y: 17 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Name Your Workflow',
    description: 'Give it a descriptive name that explains what it does.',
    highlight: { x: 25, y: 25, width: 50, height: 10 },
    cursor: { x: 50, y: 30 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Select Trigger',
    description: 'Choose what event starts this workflow.',
    highlight: { x: 20, y: 38, width: 60, height: 15 },
    cursor: { x: 50, y: 45 },
    action: 'click' as const,
    duration: 3000,
  },
  {
    title: 'Add Actions',
    description: 'Add one or more actions the workflow performs.',
    highlight: { x: 20, y: 55, width: 60, height: 25 },
    cursor: { x: 50, y: 67 },
    action: 'click' as const,
    duration: 3500,
  },
  {
    title: 'Activate Workflow',
    description: 'Toggle the workflow active when ready.',
    highlight: { x: 75, y: 15, width: 12, height: 5 },
    cursor: { x: 81, y: 17 },
    action: 'click' as const,
    duration: 2500,
  },
];

export default function CreatingWorkflowsPage() {
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
        <span className="text-slate-900 dark:text-white font-medium">Creating Workflows</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500">
          <Wrench className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Creating Workflows
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Build your first automation workflow step by step.
          </p>
          <div className="flex items-center gap-4 mt-4 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              6 min read
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
          title="Creating a Workflow"
          steps={DEMO_STEPS}
        />
      </section>

      {/* Workflow Components */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Workflow Components
        </h2>
        <div className="grid gap-4">
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Trigger</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              The event that starts the workflow. Every workflow needs exactly one trigger.
              Examples: "Contact created", "Deal stage changed".
            </p>
          </div>
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                <GitBranch className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Conditions (Optional)</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Filters that determine if the workflow should proceed. Only records matching
              all conditions will trigger actions.
            </p>
          </div>
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <Play className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Actions</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              What happens when the workflow runs. You can chain multiple actions together.
              Examples: "Send email", "Update field", "Create task".
            </p>
          </div>
        </div>
      </section>

      {/* Step by Step */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Building Your Workflow
        </h2>
        <StepList
          steps={[
            {
              title: 'Access Workflow Builder',
              description: 'Go to Settings → Automations → Workflows → Create Workflow.',
            },
            {
              title: 'Name and Describe',
              description: 'Give your workflow a clear name. Add a description for your team.',
            },
            {
              title: 'Select the Trigger',
              description: 'Choose the event that starts the workflow (create, update, delete, etc.).',
            },
            {
              title: 'Add Conditions',
              description: 'Filter when the workflow runs (e.g., only for VIP customers).',
            },
            {
              title: 'Add Actions',
              description: 'Define what happens: send email, update field, create task, etc.',
            },
            {
              title: 'Review and Test',
              description: 'Use Test Mode to see what would happen without actually executing.',
            },
            {
              title: 'Activate',
              description: 'Toggle the workflow active. Monitor the execution log.',
            },
          ]}
        />
      </section>

      {/* Example Workflow */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Example: New Lead Notification
        </h2>
        <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center text-sm font-medium">1</div>
              <div>
                <span className="text-xs text-slate-500 uppercase tracking-wider">Trigger</span>
                <p className="font-medium text-slate-900 dark:text-white">When a Lead is created</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-medium">2</div>
              <div>
                <span className="text-xs text-slate-500 uppercase tracking-wider">Condition</span>
                <p className="font-medium text-slate-900 dark:text-white">Lead Source = "Website Form"</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-medium">3</div>
              <div>
                <span className="text-xs text-slate-500 uppercase tracking-wider">Action</span>
                <p className="font-medium text-slate-900 dark:text-white">Send Slack notification to #sales channel</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-medium">4</div>
              <div>
                <span className="text-xs text-slate-500 uppercase tracking-wider">Action</span>
                <p className="font-medium text-slate-900 dark:text-white">Create follow-up task due in 1 hour</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tips */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Building Best Practices
        </h2>
        <div className="space-y-4">
          <QuickTip title="Start Simple" type="tip">
            Begin with one trigger, one condition, one action. Add complexity only
            after the basic workflow is working correctly.
          </QuickTip>
          <QuickTip title="Use Descriptive Names" type="info">
            Name workflows clearly: "New VIP Lead → Slack Alert" is better than
            "Workflow 1". Future you will thank present you.
          </QuickTip>
          <QuickTip title="Always Test First" type="warning">
            Use Test Mode before activating. Mistakes in automation can affect
            many records quickly. Test with sample data first.
          </QuickTip>
        </div>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-8">
        <Link href="/crm/learn/workflows/basics">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Previous: Workflow Basics
          </Button>
        </Link>
        <Link href="/crm/learn/workflows/triggers">
          <Button className="gap-2">
            Next: Triggers & Actions
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
