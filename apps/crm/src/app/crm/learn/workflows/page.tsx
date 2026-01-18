'use client';

import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import {
  ArrowLeft,
  ArrowRight,
  Zap,
  Clock,
  Play,
  CheckCircle,
  Workflow,
  GitBranch,
  Mail,
  Bell,
  UserPlus,
  Tag,
  Calendar,
  Settings,
} from 'lucide-react';
import { AnimatedDemo, StepList, QuickTip } from '@/components/learn/AnimatedDemo';

const DEMO_STEPS = [
  {
    title: 'Open Automations',
    description: 'Navigate to Settings → Automations to manage your workflows.',
    cursor: { x: 15, y: 80 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Create New Workflow',
    description: 'Click "New Workflow" to open the visual workflow builder.',
    highlight: { x: 80, y: 8, width: 18, height: 6 },
    cursor: { x: 88, y: 11 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Add a Trigger',
    description: 'Start by selecting what event triggers this workflow.',
    highlight: { x: 10, y: 20, width: 25, height: 15 },
    cursor: { x: 22, y: 27 },
    action: 'click' as const,
    duration: 3000,
  },
  {
    title: 'Add Actions',
    description: 'Drag action nodes onto the canvas and connect them to the trigger.',
    highlight: { x: 35, y: 20, width: 60, height: 60 },
    cursor: { x: 60, y: 50 },
    action: 'click' as const,
    duration: 3500,
  },
  {
    title: 'Activate Workflow',
    description: 'Test your workflow, then toggle it active to start automating.',
    highlight: { x: 75, y: 78, width: 20, height: 8 },
    cursor: { x: 85, y: 82 },
    action: 'click' as const,
    duration: 3000,
  },
];

const ARTICLES = [
  {
    title: 'Workflow Basics',
    description: 'Understanding triggers, conditions, and actions',
    time: '5 min',
    href: '/crm/learn/workflows/basics',
    icon: <Workflow className="w-5 h-5" />,
  },
  {
    title: 'Trigger Types',
    description: 'Events that can start a workflow',
    time: '4 min',
    href: '/crm/learn/workflows/triggers',
    icon: <Zap className="w-5 h-5" />,
  },
  {
    title: 'Conditional Logic',
    description: 'Add if/then branches to workflows',
    time: '5 min',
    href: '/crm/learn/workflows/conditions',
    icon: <GitBranch className="w-5 h-5" />,
  },
  {
    title: 'Email Actions',
    description: 'Send automated emails from workflows',
    time: '4 min',
    href: '/crm/learn/workflows/email-actions',
    icon: <Mail className="w-5 h-5" />,
  },
  {
    title: 'Task & Notification Actions',
    description: 'Create tasks and send alerts automatically',
    time: '4 min',
    href: '/crm/learn/workflows/tasks',
    icon: <Bell className="w-5 h-5" />,
  },
  {
    title: 'Testing & Debugging',
    description: 'Test workflows before going live',
    time: '4 min',
    href: '/crm/learn/workflows/testing',
    icon: <Settings className="w-5 h-5" />,
  },
];

const TRIGGERS = [
  { name: 'Record Created', description: 'When a new contact, lead, or deal is created', icon: <UserPlus className="w-5 h-5" /> },
  { name: 'Record Updated', description: 'When any field value changes', icon: <Settings className="w-5 h-5" /> },
  { name: 'Stage Changed', description: 'When a deal moves to a new pipeline stage', icon: <Workflow className="w-5 h-5" /> },
  { name: 'Tag Added', description: 'When a specific tag is applied', icon: <Tag className="w-5 h-5" /> },
  { name: 'Date Reached', description: 'When a date field reaches today', icon: <Calendar className="w-5 h-5" /> },
];

const ACTIONS = [
  { name: 'Update Field', description: 'Change a field value on the record', color: 'bg-blue-500' },
  { name: 'Send Email', description: 'Send an email to the contact', color: 'bg-emerald-500' },
  { name: 'Create Task', description: 'Create a follow-up task', color: 'bg-amber-500' },
  { name: 'Send Notification', description: 'Alert a team member', color: 'bg-violet-500' },
  { name: 'Assign Owner', description: 'Change the record owner', color: 'bg-pink-500' },
  { name: 'Add/Remove Tag', description: 'Modify tags on the record', color: 'bg-cyan-500' },
];

export default function WorkflowsLearnPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/crm/learn" className="text-slate-500 hover:text-teal-600 transition-colors">
          Learning Center
        </Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-900 dark:text-white font-medium">Workflow Automation</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-500">
          <Zap className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Workflow Automation
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Automate repetitive tasks with powerful if-this-then-that workflows.
          </p>
          <div className="flex items-center gap-4 mt-4 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              6 articles
            </span>
            <span className="flex items-center gap-1">
              <Play className="w-4 h-4" />
              Interactive demo
            </span>
          </div>
        </div>
      </div>

      {/* Workflow Demo */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Building a Workflow
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          See how to create an automated workflow using the visual builder.
        </p>
        <AnimatedDemo
          title="Workflow Builder"
          steps={DEMO_STEPS}
        />
      </section>

      {/* How Workflows Work */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          How Workflows Work
        </h2>
        <div className="p-6 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px] text-center p-4">
              <div className="w-12 h-12 rounded-full bg-cyan-100 dark:bg-cyan-500/20 flex items-center justify-center mx-auto mb-3">
                <Zap className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Trigger</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Event that starts the workflow
              </p>
            </div>
            <ArrowRight className="w-6 h-6 text-slate-300 dark:text-slate-600 hidden md:block" />
            <div className="flex-1 min-w-[200px] text-center p-4">
              <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center mx-auto mb-3">
                <GitBranch className="w-6 h-6 text-violet-600 dark:text-violet-400" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Conditions</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Optional filters to check
              </p>
            </div>
            <ArrowRight className="w-6 h-6 text-slate-300 dark:text-slate-600 hidden md:block" />
            <div className="flex-1 min-w-[200px] text-center p-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Actions</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Tasks performed automatically
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Triggers */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Available Triggers
        </h2>
        <div className="grid gap-3">
          {TRIGGERS.map((trigger) => (
            <div
              key={trigger.name}
              className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700"
            >
              <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400">
                {trigger.icon}
              </div>
              <div>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {trigger.name}
                </span>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {trigger.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Actions */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Available Actions
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {ACTIONS.map((action) => (
            <div
              key={action.name}
              className="p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700"
            >
              <div className={`w-3 h-3 rounded-full ${action.color} mb-2`} />
              <h3 className="font-semibold text-slate-900 dark:text-white text-sm mb-1">
                {action.name}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {action.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Articles */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          How-To Guides
        </h2>
        <div className="grid gap-4">
          {ARTICLES.map((article) => (
            <Link
              key={article.href}
              href={article.href}
              className="group flex items-center gap-4 p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 hover:border-teal-500/50 hover:shadow-md transition-all"
            >
              <div className="p-3 rounded-xl bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 group-hover:bg-teal-100 dark:group-hover:bg-teal-500/20 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                {article.icon}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                  {article.title}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {article.description}
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Clock className="w-4 h-4" />
                {article.time}
              </div>
              <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-teal-500 transition-colors" />
            </Link>
          ))}
        </div>
      </section>

      {/* Example Workflows */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Example Workflows
        </h2>
        <StepList
          steps={[
            {
              title: 'Welcome New Leads',
              description: 'When a lead is created → Send welcome email → Create follow-up task for tomorrow.',
            },
            {
              title: 'Deal Stage Alerts',
              description: 'When deal moves to Negotiation → Notify manager → Update priority to High.',
            },
            {
              title: 'Win/Loss Follow-up',
              description: 'When deal closed won → Send thank you email → Create onboarding task.',
            },
            {
              title: 'Inactive Lead Re-engagement',
              description: 'When last activity > 30 days → Add "Needs Re-engagement" tag → Create task.',
            },
          ]}
        />
      </section>

      {/* Best Practices */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Workflow Best Practices
        </h2>
        <div className="space-y-4">
          <QuickTip title="Start Simple" type="tip">
            Begin with simple workflows (1 trigger, 1-2 actions) and expand as needed.
            Complex workflows are harder to debug and maintain.
          </QuickTip>
          <QuickTip title="Test Before Activating" type="info">
            Always use the test feature with sample records before activating.
            This ensures your workflow behaves as expected without affecting real data.
          </QuickTip>
          <QuickTip title="Avoid Infinite Loops" type="warning">
            Be careful with "Record Updated" triggers. If your action updates the same record,
            it can create an infinite loop. Use conditions to prevent this.
          </QuickTip>
        </div>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-8">
        <Link href="/crm/learn/sequences">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Previous: Email Sequences
          </Button>
        </Link>
        <Link href="/crm/learn/reports">
          <Button className="gap-2">
            Next: Reports & Analytics
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
