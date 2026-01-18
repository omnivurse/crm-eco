'use client';

import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import {
  ArrowLeft,
  ArrowRight,
  Workflow,
  Clock,
  Play,
  CheckCircle,
  Mail,
  Timer,
  GitBranch,
  PauseCircle,
  PlayCircle,
  Users,
  Settings,
} from 'lucide-react';
import { AnimatedDemo, StepList, QuickTip } from '@/components/learn/AnimatedDemo';

const DEMO_STEPS = [
  {
    title: 'Open Sequences',
    description: 'Navigate to Sequences in the main menu to view your email sequences.',
    cursor: { x: 35, y: 7 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Create New Sequence',
    description: 'Click "New Sequence" to start building your automated email series.',
    highlight: { x: 80, y: 8, width: 18, height: 6 },
    cursor: { x: 88, y: 11 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Add Email Steps',
    description: 'Add email steps with subject, body, and timing between sends.',
    highlight: { x: 10, y: 20, width: 80, height: 50 },
    cursor: { x: 50, y: 45 },
    action: 'click' as const,
    duration: 3500,
  },
  {
    title: 'Set Wait Periods',
    description: 'Configure delays between emails (e.g., wait 2 days before next email).',
    highlight: { x: 25, y: 50, width: 50, height: 12 },
    cursor: { x: 50, y: 56 },
    action: 'click' as const,
    duration: 3000,
  },
  {
    title: 'Enroll Contacts',
    description: 'Add contacts to the sequence to start sending automatically.',
    highlight: { x: 70, y: 78, width: 25, height: 8 },
    cursor: { x: 82, y: 82 },
    action: 'click' as const,
    duration: 3000,
  },
];

const ARTICLES = [
  {
    title: 'Creating Sequences',
    description: 'Build multi-step automated email sequences',
    time: '5 min',
    href: '/crm/learn/sequences/creating',
    icon: <Workflow className="w-5 h-5" />,
  },
  {
    title: 'Email Steps',
    description: 'Configure emails with templates and merge fields',
    time: '4 min',
    href: '/crm/learn/sequences/email-steps',
    icon: <Mail className="w-5 h-5" />,
  },
  {
    title: 'Wait Steps & Timing',
    description: 'Set optimal delays between sequence emails',
    time: '3 min',
    href: '/crm/learn/sequences/timing',
    icon: <Timer className="w-5 h-5" />,
  },
  {
    title: 'Conditional Logic',
    description: 'Add if/then branches based on recipient behavior',
    time: '5 min',
    href: '/crm/learn/sequences/conditions',
    icon: <GitBranch className="w-5 h-5" />,
  },
  {
    title: 'Enrolling Contacts',
    description: 'Add contacts manually or automatically via triggers',
    time: '4 min',
    href: '/crm/learn/sequences/enrollment',
    icon: <Users className="w-5 h-5" />,
  },
  {
    title: 'Exit Conditions',
    description: 'Configure when contacts should leave the sequence',
    time: '4 min',
    href: '/crm/learn/sequences/exit-conditions',
    icon: <Settings className="w-5 h-5" />,
  },
];

const STEP_TYPES = [
  {
    type: 'Email',
    icon: <Mail className="w-5 h-5" />,
    description: 'Send a personalized email using a template with merge fields',
    color: 'bg-blue-500',
  },
  {
    type: 'Wait',
    icon: <Timer className="w-5 h-5" />,
    description: 'Pause for a specified number of days/hours before the next step',
    color: 'bg-amber-500',
  },
  {
    type: 'Condition',
    icon: <GitBranch className="w-5 h-5" />,
    description: 'Branch based on conditions like "opened email" or "clicked link"',
    color: 'bg-violet-500',
  },
];

export default function SequencesLearnPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/crm/learn" className="text-slate-500 hover:text-teal-600 transition-colors">
          Learning Center
        </Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-900 dark:text-white font-medium">Email Sequences</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500">
          <Workflow className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Email Sequences
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Create automated multi-step email campaigns that nurture leads over time.
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

      {/* Sequence Demo */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Building Your First Sequence
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Watch how to create a multi-step email sequence with automated timing.
        </p>
        <AnimatedDemo
          title="Sequence Builder"
          steps={DEMO_STEPS}
        />
      </section>

      {/* Sequences vs Campaigns */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Sequences vs. Campaigns
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-xl bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-500/10 dark:to-rose-500/10 border border-pink-200 dark:border-pink-500/30">
            <h3 className="font-semibold text-pink-800 dark:text-pink-300 mb-2 flex items-center gap-2">
              <Workflow className="w-5 h-5" />
              Sequences
            </h3>
            <ul className="space-y-2 text-sm text-pink-700 dark:text-pink-400">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Multi-step, automated over time
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Personal 1-to-1 style emails
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Stops when contact replies
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Great for sales outreach & nurturing
              </li>
            </ul>
          </div>
          <div className="p-5 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 border border-amber-200 dark:border-amber-500/30">
            <h3 className="font-semibold text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Campaigns
            </h3>
            <ul className="space-y-2 text-sm text-amber-700 dark:text-amber-400">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Single email, sent once
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Mass email to many recipients
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Marketing newsletters & announcements
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Great for promotions & updates
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Step Types */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Sequence Step Types
        </h2>
        <div className="grid gap-4">
          {STEP_TYPES.map((item) => (
            <div
              key={item.type}
              className="flex items-start gap-4 p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700"
            >
              <div className={`p-3 rounded-xl ${item.color} text-white`}>
                {item.icon}
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                  {item.type} Step
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {item.description}
                </p>
              </div>
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
              <div className="p-3 rounded-xl bg-pink-100 dark:bg-pink-500/20 text-pink-600 dark:text-pink-400 group-hover:bg-teal-100 dark:group-hover:bg-teal-500/20 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
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

      {/* Example Sequence */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Example: Cold Outreach Sequence
        </h2>
        <StepList
          steps={[
            {
              title: 'Day 1: Introduction Email',
              description: 'Introduce yourself and provide value. Keep it short and personalized.',
            },
            {
              title: 'Day 3: Follow-up #1',
              description: 'Reference your first email. Share a relevant case study or resource.',
            },
            {
              title: 'Day 7: Follow-up #2',
              description: 'Try a different angle. Ask a question to encourage a reply.',
            },
            {
              title: 'Day 14: Final Touch',
              description: 'Let them know this is your last email. Create urgency or offer help.',
            },
          ]}
        />
      </section>

      {/* Status Indicators */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Sequence Statuses
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-center">
            <div className="w-10 h-10 rounded-full bg-slate-300 dark:bg-slate-700 flex items-center justify-center mx-auto mb-2">
              <Settings className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </div>
            <span className="font-medium text-slate-900 dark:text-white text-sm">Draft</span>
          </div>
          <div className="p-4 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-center">
            <div className="w-10 h-10 rounded-full bg-emerald-300 dark:bg-emerald-500/40 flex items-center justify-center mx-auto mb-2">
              <PlayCircle className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
            </div>
            <span className="font-medium text-emerald-900 dark:text-emerald-300 text-sm">Active</span>
          </div>
          <div className="p-4 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-center">
            <div className="w-10 h-10 rounded-full bg-amber-300 dark:bg-amber-500/40 flex items-center justify-center mx-auto mb-2">
              <PauseCircle className="w-5 h-5 text-amber-700 dark:text-amber-400" />
            </div>
            <span className="font-medium text-amber-900 dark:text-amber-300 text-sm">Paused</span>
          </div>
          <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-center">
            <div className="w-10 h-10 rounded-full bg-slate-300 dark:bg-slate-700 flex items-center justify-center mx-auto mb-2">
              <CheckCircle className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </div>
            <span className="font-medium text-slate-900 dark:text-white text-sm">Archived</span>
          </div>
        </div>
      </section>

      {/* Best Practices */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Sequence Best Practices
        </h2>
        <div className="space-y-4">
          <QuickTip title="Keep It Personal" type="tip">
            Write sequences as if you're emailing one person. Use merge fields to personalize
            the subject and body. Avoid generic marketing language.
          </QuickTip>
          <QuickTip title="Optimal Timing" type="info">
            Space emails 2-4 days apart for cold outreach. For nurture sequences,
            5-7 days between emails is often effective. Test and adjust based on replies.
          </QuickTip>
          <QuickTip title="Set Exit Conditions" type="warning">
            Always configure exit conditions like "reply received" or "booked meeting."
            You don't want to keep emailing someone who has already responded.
          </QuickTip>
        </div>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-8">
        <Link href="/crm/learn/campaigns">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Previous: Email Campaigns
          </Button>
        </Link>
        <Link href="/crm/learn/workflows">
          <Button className="gap-2">
            Next: Workflow Automation
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
