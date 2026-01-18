'use client';

import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import {
  ArrowLeft,
  ArrowRight,
  Workflow,
  Clock,
  CheckCircle,
  Plus,
  Mail,
  Timer,
  GitBranch,
  Users,
  Play,
  Pause,
} from 'lucide-react';
import { AnimatedDemo, StepList, QuickTip } from '@/components/learn/AnimatedDemo';

const DEMO_STEPS = [
  {
    title: 'Navigate to Sequences',
    description: 'Click "Sequences" in the navigation to view your email sequences.',
    cursor: { x: 40, y: 7 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Click "New Sequence"',
    description: 'Click the "New Sequence" button to create a new automated email series.',
    highlight: { x: 80, y: 15, width: 18, height: 6 },
    cursor: { x: 88, y: 18 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Name Your Sequence',
    description: 'Give your sequence a descriptive name like "Cold Outreach" or "Onboarding".',
    highlight: { x: 20, y: 18, width: 60, height: 10 },
    cursor: { x: 50, y: 23 },
    action: 'type' as const,
    duration: 2500,
  },
  {
    title: 'Add First Email Step',
    description: 'Click "Add Step" and select "Email" to create your first email.',
    highlight: { x: 20, y: 30, width: 60, height: 35 },
    cursor: { x: 50, y: 47 },
    action: 'click' as const,
    duration: 3500,
  },
  {
    title: 'Configure Email Content',
    description: 'Write the subject and body for this step. Use merge fields for personalization.',
    highlight: { x: 20, y: 35, width: 60, height: 40 },
    cursor: { x: 50, y: 55 },
    action: 'type' as const,
    duration: 3500,
  },
  {
    title: 'Add Wait Step',
    description: 'Click "Add Step" and select "Wait" to add a delay before the next email.',
    highlight: { x: 20, y: 68, width: 20, height: 8 },
    cursor: { x: 30, y: 72 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Add More Steps',
    description: 'Continue adding email and wait steps to build your complete sequence.',
    cursor: { x: 50, y: 60 },
    duration: 2500,
  },
  {
    title: 'Activate Sequence',
    description: 'When ready, click "Activate" to make the sequence available for enrollments.',
    highlight: { x: 75, y: 78, width: 20, height: 8 },
    cursor: { x: 85, y: 82 },
    action: 'click' as const,
    duration: 2500,
  },
];

const SEQUENCE_EXAMPLES = [
  {
    name: 'Cold Outreach',
    steps: ['Day 1: Introduction', 'Day 3: Follow-up', 'Day 7: Value prop', 'Day 14: Final touch'],
    goal: 'Book meetings with cold prospects',
  },
  {
    name: 'Onboarding',
    steps: ['Day 0: Welcome', 'Day 2: Getting started', 'Day 5: Tips & tricks', 'Day 14: Check-in'],
    goal: 'Help new customers succeed',
  },
  {
    name: 'Re-engagement',
    steps: ['Day 0: We miss you', 'Day 5: What you\'re missing', 'Day 10: Special offer'],
    goal: 'Win back inactive customers',
  },
];

export default function CreatingSequencesPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/crm/learn" className="text-slate-500 hover:text-teal-600 transition-colors">
          Learning Center
        </Link>
        <span className="text-slate-400">/</span>
        <Link href="/crm/learn/sequences" className="text-slate-500 hover:text-teal-600 transition-colors">
          Sequences
        </Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-900 dark:text-white font-medium">Creating Sequences</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500">
          <Workflow className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Creating Email Sequences
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Build automated multi-step email campaigns that nurture leads over time.
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
          Video Walkthrough
        </h2>
        <AnimatedDemo
          title="Creating a Sequence"
          steps={DEMO_STEPS}
        />
      </section>

      {/* What is a Sequence */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          What is an Email Sequence?
        </h2>
        <div className="p-6 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            An <strong>Email Sequence</strong> is a series of automated emails sent over time.
            Unlike campaigns (one email to many people), sequences send multiple emails to
            individual contacts based on a schedule you define.
          </p>
          <div className="flex items-center gap-2 flex-wrap mt-4">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-100 dark:bg-blue-500/20">
              <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-blue-800 dark:text-blue-300">Email 1</span>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400" />
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-100 dark:bg-amber-500/20">
              <Timer className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-medium text-amber-800 dark:text-amber-300">Wait 3 days</span>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400" />
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-100 dark:bg-blue-500/20">
              <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-blue-800 dark:text-blue-300">Email 2</span>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400" />
            <span className="text-slate-400">...</span>
          </div>
        </div>
      </section>

      {/* Step Types */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Step Types
        </h2>
        <div className="grid gap-4">
          <div className="flex items-start gap-4 p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="p-3 rounded-xl bg-blue-500 text-white">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Email Step</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Send a personalized email using a template with merge fields. Each email
                step has its own subject and body content.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4 p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="p-3 rounded-xl bg-amber-500 text-white">
              <Timer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Wait Step</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Pause for a specified time (days or hours) before moving to the next step.
                Example: "Wait 3 days" after the first email before sending the follow-up.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4 p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="p-3 rounded-xl bg-violet-500 text-white">
              <GitBranch className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Condition Step</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Branch based on contact behavior. For example: "If opened previous email, send Email A;
                otherwise, send Email B." Great for A/B testing and personalization.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Step by Step */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Step-by-Step Instructions
        </h2>
        <StepList
          steps={[
            {
              title: 'Go to Sequences',
              description: 'Navigate to the Sequences module from the main navigation.',
            },
            {
              title: 'Click "New Sequence"',
              description: 'Click the button to start creating a new sequence.',
            },
            {
              title: 'Name Your Sequence',
              description: 'Choose a descriptive name like "Cold Outreach - Tech Companies" or "Onboarding Series".',
            },
            {
              title: 'Add Your First Email Step',
              description: 'Click "Add Step", select "Email", and write your first email with subject and body.',
            },
            {
              title: 'Add a Wait Step',
              description: 'After the email, add a "Wait" step to define how long to wait before the next email (e.g., 3 days).',
            },
            {
              title: 'Continue Building',
              description: 'Add more email and wait steps. A typical sequence has 3-5 emails spread over 2-3 weeks.',
            },
            {
              title: 'Configure Exit Conditions',
              description: 'Set rules for when contacts should exit (e.g., if they reply or book a meeting).',
            },
            {
              title: 'Activate the Sequence',
              description: 'When ready, activate the sequence. Now you can enroll contacts to start receiving emails.',
            },
          ]}
        />
      </section>

      {/* Example Sequences */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Example Sequences
        </h2>
        <div className="grid gap-4">
          {SEQUENCE_EXAMPLES.map((example) => (
            <div
              key={example.name}
              className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700"
            >
              <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
                {example.name}
              </h3>
              <p className="text-sm text-slate-500 mb-3">Goal: {example.goal}</p>
              <div className="flex flex-wrap gap-2">
                {example.steps.map((step, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {step}
                    </span>
                    {index < example.steps.length - 1 && (
                      <ArrowRight className="w-3 h-3 text-slate-300" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Sequence States */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Sequence States
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-center">
            <span className="block text-2xl mb-2">📝</span>
            <span className="font-medium text-slate-900 dark:text-white text-sm">Draft</span>
            <p className="text-xs text-slate-500 mt-1">Being edited, not enrollable</p>
          </div>
          <div className="p-4 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-center">
            <span className="block text-2xl mb-2">▶️</span>
            <span className="font-medium text-emerald-800 dark:text-emerald-300 text-sm">Active</span>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Running, accepting enrollments</p>
          </div>
          <div className="p-4 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-center">
            <span className="block text-2xl mb-2">⏸️</span>
            <span className="font-medium text-amber-800 dark:text-amber-300 text-sm">Paused</span>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Temporarily stopped</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-center">
            <span className="block text-2xl mb-2">📦</span>
            <span className="font-medium text-slate-900 dark:text-white text-sm">Archived</span>
            <p className="text-xs text-slate-500 mt-1">No longer in use</p>
          </div>
        </div>
      </section>

      {/* Tips */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Tips & Best Practices
        </h2>
        <div className="space-y-4">
          <QuickTip title="Start Short" type="tip">
            Begin with 3-4 emails over 2 weeks. You can always add more steps later.
            Shorter sequences are easier to manage and test.
          </QuickTip>
          <QuickTip title="Optimal Wait Times" type="info">
            For cold outreach, 2-4 days between emails works well. For nurture sequences,
            5-7 days is often better. Test different timing to find what works for your audience.
          </QuickTip>
          <QuickTip title="Set Exit Conditions" type="warning">
            Always configure exit conditions like "reply received" or "meeting booked."
            You don't want to keep emailing someone who has already responded.
          </QuickTip>
          <QuickTip title="Write Like a Human" type="tip">
            Sequences should feel personal, not automated. Write in first person,
            keep emails short, and make each one valuable on its own.
          </QuickTip>
        </div>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-8">
        <Link href="/crm/learn/sequences">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Sequences
          </Button>
        </Link>
        <Link href="/crm/learn/sequences/enrollment">
          <Button className="gap-2">
            Next: Enrolling Contacts
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
