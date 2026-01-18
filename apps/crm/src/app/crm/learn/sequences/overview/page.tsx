'use client';

import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import {
  ArrowLeft,
  ArrowRight,
  Zap,
  Clock,
  CheckCircle,
  Mail,
  Timer,
  GitBranch,
  UserCheck,
  Pause,
  Play,
} from 'lucide-react';
import { AnimatedDemo, StepList, QuickTip } from '@/components/learn/AnimatedDemo';

const DEMO_STEPS = [
  {
    title: 'Navigate to Sequences',
    description: 'Click "Sequences" in the main navigation.',
    cursor: { x: 8, y: 38 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'View Sequence List',
    description: 'See all your sequences with status and enrollment counts.',
    highlight: { x: 15, y: 20, width: 80, height: 60 },
    cursor: { x: 55, y: 50 },
    duration: 3000,
  },
  {
    title: 'Open a Sequence',
    description: 'Click on a sequence to view its steps and enrolled contacts.',
    cursor: { x: 55, y: 35 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'View Sequence Steps',
    description: 'See the visual timeline of emails and wait periods.',
    highlight: { x: 15, y: 25, width: 70, height: 50 },
    cursor: { x: 50, y: 50 },
    duration: 3500,
  },
  {
    title: 'Check Enrollments',
    description: 'See contacts currently enrolled and their progress.',
    highlight: { x: 15, y: 78, width: 70, height: 15 },
    cursor: { x: 50, y: 85 },
    duration: 2500,
  },
];

export default function SequencesOverviewPage() {
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
        <span className="text-slate-900 dark:text-white font-medium">What are Sequences?</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-500">
          <Zap className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            What are Sequences?
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Automated multi-step email campaigns that nurture contacts over time.
          </p>
          <div className="flex items-center gap-4 mt-4 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              3 min read
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
          title="Understanding Sequences"
          steps={DEMO_STEPS}
        />
      </section>

      {/* What is a Sequence */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Sequences vs. Campaigns
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          While campaigns send one email to many people at once, sequences send a series
          of emails to individuals over time. Think of it as automated follow-up.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="p-5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
            <h3 className="font-semibold text-amber-800 dark:text-amber-300 mb-2">Campaigns</h3>
            <ul className="text-sm text-amber-700 dark:text-amber-400 space-y-1">
              <li>• One email, one time</li>
              <li>• Sent to many recipients at once</li>
              <li>• Good for announcements, newsletters</li>
              <li>• Manual send timing</li>
            </ul>
          </div>
          <div className="p-5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30">
            <h3 className="font-semibold text-rose-800 dark:text-rose-300 mb-2">Sequences</h3>
            <ul className="text-sm text-rose-700 dark:text-rose-400 space-y-1">
              <li>• Multiple emails over days/weeks</li>
              <li>• Each person gets their own timeline</li>
              <li>• Good for nurturing, onboarding</li>
              <li>• Automatic timing based on enrollment</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Sequence Components */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Sequence Building Blocks
        </h2>
        <div className="grid gap-4">
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                <Mail className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Email Steps</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              The actual emails that get sent. Each step has its own subject, body, and timing.
            </p>
          </div>
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <Timer className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Wait Steps</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Delays between emails. "Wait 3 days" gives the recipient time to respond.
            </p>
          </div>
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <GitBranch className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Exit Conditions</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Rules that remove someone from the sequence (e.g., they reply, book a meeting).
            </p>
          </div>
        </div>
      </section>

      {/* Example Sequence */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Example: Sales Follow-up Sequence
        </h2>
        <div className="relative pl-6 border-l-2 border-rose-200 dark:border-rose-500/30 space-y-6">
          {[
            { day: 'Day 0', title: 'Initial Outreach', description: 'Personalized intro email after meeting' },
            { day: 'Day 3', title: 'Value Add', description: 'Share relevant case study or resource' },
            { day: 'Day 7', title: 'Check In', description: 'Friendly follow-up asking for thoughts' },
            { day: 'Day 14', title: 'Last Touch', description: 'Final follow-up with clear next steps' },
          ].map((step, index) => (
            <div key={step.day} className="relative">
              <div className="absolute -left-[25px] w-4 h-4 rounded-full bg-rose-500 border-4 border-white dark:border-slate-900" />
              <div className="bg-white dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-xs font-medium text-rose-600 dark:text-rose-400">{step.day}</span>
                <h4 className="font-semibold text-slate-900 dark:text-white">{step.title}</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Why Use Sequences?
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { icon: <Clock className="w-5 h-5" />, title: 'Save Time', description: 'Write once, send automatically forever' },
            { icon: <CheckCircle className="w-5 h-5" />, title: 'Consistent Follow-up', description: 'Never forget to follow up again' },
            { icon: <UserCheck className="w-5 h-5" />, title: 'Scale Personally', description: 'Personal touch at scale' },
            { icon: <Play className="w-5 h-5" />, title: 'Always Working', description: 'Runs 24/7 while you focus elsewhere' },
          ].map((benefit) => (
            <div
              key={benefit.title}
              className="flex items-start gap-3 p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700"
            >
              <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400">
                {benefit.icon}
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">{benefit.title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">{benefit.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Tips */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Getting Started Tips
        </h2>
        <div className="space-y-4">
          <QuickTip title="Start Simple" type="tip">
            Begin with a 3-4 email sequence. You can always add more steps later
            once you see what works.
          </QuickTip>
          <QuickTip title="Set Exit Conditions" type="info">
            Always set up exit conditions (reply, meeting booked) to avoid awkward
            follow-ups after someone has already responded.
          </QuickTip>
          <QuickTip title="Space Out Emails" type="warning">
            Give 2-3 days between emails minimum. Too frequent = annoying.
            Too sparse = lose momentum.
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
        <Link href="/crm/learn/sequences/building">
          <Button className="gap-2">
            Next: Building a Sequence
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
