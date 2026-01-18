'use client';

import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import {
  ArrowLeft,
  ArrowRight,
  UserPlus,
  Clock,
  CheckCircle,
  Users,
  Upload,
  Filter,
  Play,
  Pause,
  UserMinus,
} from 'lucide-react';
import { AnimatedDemo, StepList, QuickTip } from '@/components/learn/AnimatedDemo';

const DEMO_STEPS = [
  {
    title: 'Open Your Sequence',
    description: 'Navigate to the sequence you want to enroll contacts in.',
    cursor: { x: 50, y: 35 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Click Enroll',
    description: 'Click the "Enroll Contacts" button.',
    highlight: { x: 70, y: 12, width: 18, height: 5 },
    cursor: { x: 79, y: 14 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Select Contacts',
    description: 'Choose contacts from a view, filter, or search.',
    highlight: { x: 20, y: 25, width: 60, height: 45 },
    cursor: { x: 50, y: 47 },
    action: 'click' as const,
    duration: 3500,
  },
  {
    title: 'Review Selection',
    description: 'Verify the contacts you want to enroll.',
    highlight: { x: 20, y: 72, width: 60, height: 10 },
    cursor: { x: 50, y: 77 },
    duration: 2500,
  },
  {
    title: 'Confirm Enrollment',
    description: 'Click "Enroll" to start the sequence for these contacts.',
    highlight: { x: 65, y: 85, width: 18, height: 5 },
    cursor: { x: 74, y: 87 },
    action: 'click' as const,
    duration: 2500,
  },
];

export default function EnrollingPage() {
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
        <span className="text-slate-900 dark:text-white font-medium">Enrolling Contacts</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500">
          <UserPlus className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Enrolling Contacts in Sequences
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Add contacts to your sequences manually or automatically through triggers.
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
          title="Enrolling Contacts"
          steps={DEMO_STEPS}
        />
      </section>

      {/* Enrollment Methods */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Ways to Enroll Contacts
        </h2>
        <div className="grid gap-4">
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Manual Selection</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Select individual contacts from the contact list or search. Great for
              targeted, one-off enrollments.
            </p>
          </div>
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <Filter className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white">From Saved View</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Enroll all contacts matching a saved view's filters. Perfect for
              segmented outreach campaigns.
            </p>
          </div>
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400">
                <Upload className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white">CSV Import</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Upload a CSV with email addresses. Matching contacts are enrolled;
              new contacts can optionally be created.
            </p>
          </div>
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <Play className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Automatic Triggers</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Set up triggers to auto-enroll contacts when they meet criteria
              (e.g., new lead created, tag added).
            </p>
          </div>
        </div>
      </section>

      {/* Managing Enrollments */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Managing Enrollments
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { icon: <Play className="w-5 h-5" />, title: 'Active', description: 'Currently receiving sequence emails' },
            { icon: <Pause className="w-5 h-5" />, title: 'Paused', description: 'Temporarily stopped, can resume' },
            { icon: <CheckCircle className="w-5 h-5" />, title: 'Completed', description: 'Finished all steps successfully' },
            { icon: <UserMinus className="w-5 h-5" />, title: 'Exited', description: 'Left due to exit condition (reply, etc.)' },
          ].map((status) => (
            <div
              key={status.title}
              className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700"
            >
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {status.icon}
              </div>
              <div>
                <h3 className="font-medium text-slate-900 dark:text-white">{status.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{status.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Step by Step */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          How to Enroll Contacts
        </h2>
        <StepList
          steps={[
            {
              title: 'Open the Sequence',
              description: 'Navigate to Sequences and click on the sequence you want to use.',
            },
            {
              title: 'Click Enroll Contacts',
              description: 'Click the "Enroll Contacts" button in the top toolbar.',
            },
            {
              title: 'Choose Selection Method',
              description: 'Select from saved view, search, or upload CSV.',
            },
            {
              title: 'Select Contacts',
              description: 'Check the contacts you want to enroll. Review the count.',
            },
            {
              title: 'Confirm Enrollment',
              description: 'Click "Enroll" to add them to the sequence.',
            },
            {
              title: 'Monitor Progress',
              description: 'View enrolled contacts in the Enrollments tab.',
            },
          ]}
        />
      </section>

      {/* Tips */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Enrollment Tips
        </h2>
        <div className="space-y-4">
          <QuickTip title="Check for Existing Enrollments" type="tip">
            Contacts can't be enrolled in the same sequence twice while active.
            Complete or remove existing enrollment first.
          </QuickTip>
          <QuickTip title="Start Small" type="info">
            For new sequences, start with a small test group (10-20 contacts)
            to verify everything works before enrolling your full list.
          </QuickTip>
          <QuickTip title="Respect Opt-outs" type="warning">
            Unsubscribed contacts are automatically excluded from enrollment.
            Never manually add someone who has opted out.
          </QuickTip>
        </div>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-8">
        <Link href="/crm/learn/sequences/building">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Previous: Building a Sequence
          </Button>
        </Link>
        <Link href="/crm/learn/sequences/analytics">
          <Button className="gap-2">
            Next: Sequence Analytics
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
