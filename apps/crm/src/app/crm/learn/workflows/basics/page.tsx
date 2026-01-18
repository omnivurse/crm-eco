'use client';

import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import {
  ArrowLeft,
  ArrowRight,
  Zap,
  Clock,
  CheckCircle,
  Play,
  GitBranch,
  Mail,
  Bell,
  UserPlus,
  Tag,
  Settings,
  AlertCircle,
} from 'lucide-react';
import { AnimatedDemo, StepList, QuickTip } from '@/components/learn/AnimatedDemo';

const DEMO_STEPS = [
  {
    title: 'Navigate to Automations',
    description: 'Go to Settings → Automations to view your workflows.',
    cursor: { x: 15, y: 80 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'View Workflow List',
    description: 'You\'ll see all your workflows organized by status (Active, Draft, Paused).',
    highlight: { x: 22, y: 15, width: 76, height: 75 },
    cursor: { x: 50, y: 45 },
    duration: 3000,
  },
  {
    title: 'Click "New Workflow"',
    description: 'Click the button to open the visual workflow builder.',
    highlight: { x: 80, y: 15, width: 18, height: 6 },
    cursor: { x: 88, y: 18 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Select a Trigger',
    description: 'Choose what event starts this workflow (e.g., "Record Created").',
    highlight: { x: 5, y: 20, width: 25, height: 60 },
    cursor: { x: 17, y: 40 },
    action: 'click' as const,
    duration: 3000,
  },
  {
    title: 'Add Actions',
    description: 'Drag action nodes onto the canvas and connect them with lines.',
    highlight: { x: 32, y: 20, width: 65, height: 60 },
    cursor: { x: 60, y: 50 },
    action: 'click' as const,
    duration: 3500,
  },
  {
    title: 'Configure & Save',
    description: 'Configure each action, then save and activate your workflow.',
    highlight: { x: 75, y: 82, width: 20, height: 8 },
    cursor: { x: 85, y: 86 },
    action: 'click' as const,
    duration: 2500,
  },
];

export default function WorkflowBasicsPage() {
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
        <span className="text-slate-900 dark:text-white font-medium">Workflow Basics</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-500">
          <Zap className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Workflow Basics
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Understand the fundamentals of workflow automation in CRM Eco.
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
          Video Overview
        </h2>
        <AnimatedDemo
          title="Workflow Basics"
          steps={DEMO_STEPS}
        />
      </section>

      {/* What is a Workflow */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          What is a Workflow?
        </h2>
        <div className="p-6 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            A <strong>Workflow</strong> is an automated process that runs when certain conditions are met.
            Think of it as "if this happens, then do that" - but for your CRM data.
          </p>
          <div className="flex items-center justify-center gap-4 mt-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-cyan-100 dark:bg-cyan-500/20 flex items-center justify-center mx-auto mb-2">
                <Zap className="w-8 h-8 text-cyan-600 dark:text-cyan-400" />
              </div>
              <span className="text-sm font-medium text-slate-900 dark:text-white">Trigger</span>
              <p className="text-xs text-slate-500">When this happens...</p>
            </div>
            <ArrowRight className="w-8 h-8 text-slate-300" />
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center mx-auto mb-2">
                <GitBranch className="w-8 h-8 text-violet-600 dark:text-violet-400" />
              </div>
              <span className="text-sm font-medium text-slate-900 dark:text-white">Conditions</span>
              <p className="text-xs text-slate-500">If these are true...</p>
            </div>
            <ArrowRight className="w-8 h-8 text-slate-300" />
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mx-auto mb-2">
                <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="text-sm font-medium text-slate-900 dark:text-white">Actions</span>
              <p className="text-xs text-slate-500">Then do this.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Core Concepts */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Core Concepts
        </h2>

        {/* Triggers */}
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <Zap className="w-5 h-5 text-cyan-500" />
            Triggers
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            A trigger is the event that starts a workflow. Every workflow must have exactly one trigger.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { name: 'Record Created', desc: 'When a new contact, lead, or deal is added' },
              { name: 'Record Updated', desc: 'When any field value changes on a record' },
              { name: 'Stage Changed', desc: 'When a deal moves to a different pipeline stage' },
              { name: 'Date Reached', desc: 'When a date field equals today\'s date' },
            ].map((trigger) => (
              <div key={trigger.name} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                <span className="font-medium text-slate-900 dark:text-white text-sm">{trigger.name}</span>
                <p className="text-xs text-slate-500 mt-1">{trigger.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Conditions */}
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-violet-500" />
            Conditions
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Conditions filter which records the workflow applies to. They're optional but powerful.
          </p>
          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Example conditions:</p>
            <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-1">
              <li>• Status equals "Active"</li>
              <li>• Deal value is greater than $10,000</li>
              <li>• Tag contains "VIP"</li>
              <li>• Owner equals "Current User"</li>
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-500" />
            Actions
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Actions are what the workflow does when triggered and conditions are met.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { icon: <Settings className="w-4 h-4" />, name: 'Update Field', color: 'bg-blue-500' },
              { icon: <Mail className="w-4 h-4" />, name: 'Send Email', color: 'bg-emerald-500' },
              { icon: <Bell className="w-4 h-4" />, name: 'Send Notification', color: 'bg-amber-500' },
              { icon: <UserPlus className="w-4 h-4" />, name: 'Assign Owner', color: 'bg-violet-500' },
              { icon: <Tag className="w-4 h-4" />, name: 'Add/Remove Tag', color: 'bg-pink-500' },
              { icon: <CheckCircle className="w-4 h-4" />, name: 'Create Task', color: 'bg-cyan-500' },
            ].map((action) => (
              <div key={action.name} className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                <div className={`p-1.5 rounded ${action.color} text-white`}>
                  {action.icon}
                </div>
                <span className="text-sm font-medium text-slate-900 dark:text-white">{action.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Real Examples */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Real-World Examples
        </h2>
        <div className="space-y-4">
          <div className="p-5 rounded-xl bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-500/10 dark:to-green-500/10 border border-emerald-200 dark:border-emerald-500/30">
            <h3 className="font-semibold text-emerald-800 dark:text-emerald-300 mb-2">
              Welcome New Leads
            </h3>
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <span className="px-2 py-1 rounded bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300">
                When: Lead created
              </span>
              <ArrowRight className="w-4 h-4 text-emerald-400" />
              <span className="px-2 py-1 rounded bg-emerald-100 dark:bg-emerald-500/30 text-emerald-700 dark:text-emerald-300">
                Send welcome email
              </span>
              <ArrowRight className="w-4 h-4 text-emerald-400" />
              <span className="px-2 py-1 rounded bg-emerald-100 dark:bg-emerald-500/30 text-emerald-700 dark:text-emerald-300">
                Create follow-up task
              </span>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-500/10 dark:to-purple-500/10 border border-violet-200 dark:border-violet-500/30">
            <h3 className="font-semibold text-violet-800 dark:text-violet-300 mb-2">
              High-Value Deal Alert
            </h3>
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <span className="px-2 py-1 rounded bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300">
                When: Deal created
              </span>
              <ArrowRight className="w-4 h-4 text-violet-400" />
              <span className="px-2 py-1 rounded bg-violet-100 dark:bg-violet-500/30 text-violet-700 dark:text-violet-300">
                If: Value &gt; $50,000
              </span>
              <ArrowRight className="w-4 h-4 text-violet-400" />
              <span className="px-2 py-1 rounded bg-violet-100 dark:bg-violet-500/30 text-violet-700 dark:text-violet-300">
                Notify sales manager
              </span>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 border border-amber-200 dark:border-amber-500/30">
            <h3 className="font-semibold text-amber-800 dark:text-amber-300 mb-2">
              Deal Won Celebration
            </h3>
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <span className="px-2 py-1 rounded bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300">
                When: Stage = Won
              </span>
              <ArrowRight className="w-4 h-4 text-amber-400" />
              <span className="px-2 py-1 rounded bg-amber-100 dark:bg-amber-500/30 text-amber-700 dark:text-amber-300">
                Send thank you email
              </span>
              <ArrowRight className="w-4 h-4 text-amber-400" />
              <span className="px-2 py-1 rounded bg-amber-100 dark:bg-amber-500/30 text-amber-700 dark:text-amber-300">
                Create onboarding task
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Tips */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Tips & Best Practices
        </h2>
        <div className="space-y-4">
          <QuickTip title="Start Simple" type="tip">
            Begin with workflows that have one trigger and one action. You can add complexity
            later once you understand how they work.
          </QuickTip>
          <QuickTip title="Test Before Activating" type="info">
            Always use the test feature with a sample record before activating. This ensures
            your workflow behaves as expected without affecting real data.
          </QuickTip>
          <QuickTip title="Watch for Loops" type="warning">
            Be careful with "Record Updated" triggers. If your action updates the same record,
            it can create an infinite loop. Use conditions to prevent this.
          </QuickTip>
          <QuickTip title="Document Your Workflows" type="tip">
            Add descriptions to your workflows explaining what they do and why. Future you
            (or your team) will thank you when debugging.
          </QuickTip>
        </div>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-8">
        <Link href="/crm/learn/workflows">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Workflows
          </Button>
        </Link>
        <Link href="/crm/learn/workflows/triggers">
          <Button className="gap-2">
            Next: Trigger Types
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
