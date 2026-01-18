'use client';

import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import {
  ArrowLeft,
  ArrowRight,
  Merge,
  Clock,
  CheckCircle,
  AlertTriangle,
  Search,
  Users,
  ArrowRightLeft,
  History,
} from 'lucide-react';
import { AnimatedDemo, StepList, QuickTip } from '@/components/learn/AnimatedDemo';

const DEMO_STEPS = [
  {
    title: 'Go to Contacts',
    description: 'Navigate to the Contacts module from the main navigation.',
    cursor: { x: 8, y: 20 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Select Duplicates',
    description: 'Use checkboxes to select 2-3 duplicate contact records.',
    highlight: { x: 5, y: 30, width: 5, height: 25 },
    cursor: { x: 7, y: 42 },
    action: 'click' as const,
    duration: 3000,
  },
  {
    title: 'Click Merge',
    description: 'Click the "Merge" button in the actions toolbar.',
    highlight: { x: 75, y: 15, width: 12, height: 5 },
    cursor: { x: 81, y: 17 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Choose Master Record',
    description: 'Select which record should be the primary (master) record.',
    highlight: { x: 20, y: 30, width: 60, height: 15 },
    cursor: { x: 50, y: 37 },
    action: 'click' as const,
    duration: 3000,
  },
  {
    title: 'Review Merged Data',
    description: 'Review the combined data. Choose which values to keep for each field.',
    highlight: { x: 20, y: 48, width: 60, height: 30 },
    cursor: { x: 50, y: 63 },
    duration: 3500,
  },
  {
    title: 'Confirm Merge',
    description: 'Click "Merge Contacts" to complete. This cannot be undone.',
    highlight: { x: 60, y: 82, width: 20, height: 6 },
    cursor: { x: 70, y: 85 },
    action: 'click' as const,
    duration: 2500,
  },
];

export default function MergingPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/crm/learn" className="text-slate-500 hover:text-teal-600 transition-colors">
          Learning Center
        </Link>
        <span className="text-slate-400">/</span>
        <Link href="/crm/learn/contacts" className="text-slate-500 hover:text-teal-600 transition-colors">
          Contacts
        </Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-900 dark:text-white font-medium">Merging Duplicates</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500">
          <Merge className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Merging Duplicate Contacts
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Combine duplicate records while preserving all important data and history.
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
          title="Merging Duplicate Contacts"
          steps={DEMO_STEPS}
        />
      </section>

      {/* Why Merge */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Why Merge Duplicates?
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Duplicate contacts cause confusion and data quality issues. Merging them:
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { icon: <Users className="w-5 h-5" />, title: 'Single Source of Truth', description: 'One record per person, no confusion' },
            { icon: <History className="w-5 h-5" />, title: 'Combined History', description: 'All activities merged into one timeline' },
            { icon: <ArrowRightLeft className="w-5 h-5" />, title: 'Accurate Reporting', description: 'Correct counts and metrics' },
            { icon: <CheckCircle className="w-5 h-5" />, title: 'Better Outreach', description: 'No duplicate emails to the same person' },
          ].map((feature) => (
            <div
              key={feature.title}
              className="flex items-start gap-3 p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700"
            >
              <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400">
                {feature.icon}
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">{feature.title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* What Gets Merged */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          What Gets Merged?
        </h2>
        <div className="grid gap-4">
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              <h3 className="font-semibold text-slate-900 dark:text-white">Field Values</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              You choose which values to keep for each field. The master record's values are
              selected by default, but you can pick from any duplicate.
            </p>
          </div>
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              <h3 className="font-semibold text-slate-900 dark:text-white">Activity History</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              All emails, calls, meetings, and notes from all records are combined into
              the master record's timeline.
            </p>
          </div>
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              <h3 className="font-semibold text-slate-900 dark:text-white">Related Records</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Deals, tasks, and other related records are reassigned to the master contact.
            </p>
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
              title: 'Find Duplicates',
              description: 'Search or filter to find duplicate contacts. Look for same name, email, or phone.',
            },
            {
              title: 'Select Records',
              description: 'Use the checkboxes to select 2-3 duplicate records. You can merge up to 3 at once.',
            },
            {
              title: 'Open Merge Dialog',
              description: 'Click the "Merge" button in the toolbar above the contact list.',
            },
            {
              title: 'Choose Master Record',
              description: 'Select which record should be kept as the primary. This affects the record ID.',
            },
            {
              title: 'Review Each Field',
              description: 'For each field, verify which value to keep. Click to select from any duplicate.',
            },
            {
              title: 'Confirm and Merge',
              description: 'Click "Merge Contacts". The duplicates are deleted; only the master remains.',
            },
          ]}
        />
      </section>

      {/* Tips */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Important Notes
        </h2>
        <div className="space-y-4">
          <QuickTip title="Merging is Permanent" type="warning">
            Once merged, duplicates are permanently deleted. Review carefully before confirming.
            There is no undo option.
          </QuickTip>
          <QuickTip title="Check Activity Counts" type="tip">
            Before merging, check how many activities each record has. You might want to make
            the record with more history the master.
          </QuickTip>
          <QuickTip title="Prevent Future Duplicates" type="info">
            Enable duplicate detection in Settings → Contacts → Duplicate Rules. The system
            can warn users when creating potential duplicates.
          </QuickTip>
        </div>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-8">
        <Link href="/crm/learn/contacts/fields">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Previous: Custom Fields
          </Button>
        </Link>
        <Link href="/crm/learn/leads">
          <Button className="gap-2">
            Next: Lead Management
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
