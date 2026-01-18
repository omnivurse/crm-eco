'use client';

import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import {
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  Clock,
  CheckCircle,
  Users,
  Target,
  Building,
  UserPlus,
  DollarSign,
} from 'lucide-react';
import { AnimatedDemo, StepList, QuickTip } from '@/components/learn/AnimatedDemo';

const DEMO_STEPS = [
  {
    title: 'Open Lead Record',
    description: 'Click on a qualified lead to open their detail page.',
    cursor: { x: 50, y: 35 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Click Convert',
    description: 'Click the "Convert" button in the actions toolbar.',
    highlight: { x: 75, y: 10, width: 15, height: 5 },
    cursor: { x: 82, y: 12 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Review Contact Info',
    description: 'Verify the contact information that will be created.',
    highlight: { x: 15, y: 25, width: 70, height: 20 },
    cursor: { x: 50, y: 35 },
    duration: 3000,
  },
  {
    title: 'Create Deal (Optional)',
    description: 'Optionally create a deal associated with this new contact.',
    highlight: { x: 15, y: 48, width: 70, height: 18 },
    cursor: { x: 25, y: 52 },
    action: 'click' as const,
    duration: 3000,
  },
  {
    title: 'Confirm Conversion',
    description: 'Click "Convert Lead" to complete the process.',
    highlight: { x: 60, y: 75, width: 25, height: 6 },
    cursor: { x: 72, y: 78 },
    action: 'click' as const,
    duration: 2500,
  },
];

export default function ConvertingPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/crm/learn" className="text-slate-500 hover:text-teal-600 transition-colors">
          Learning Center
        </Link>
        <span className="text-slate-400">/</span>
        <Link href="/crm/learn/leads" className="text-slate-500 hover:text-teal-600 transition-colors">
          Leads
        </Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-900 dark:text-white font-medium">Converting Leads</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500">
          <ArrowRightLeft className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Converting Leads
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Turn qualified leads into contacts and deals to progress them in your sales process.
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
          title="Converting a Lead"
          steps={DEMO_STEPS}
        />
      </section>

      {/* What Happens */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          What Happens During Conversion?
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          When you convert a lead, the system creates new records and transfers all relevant data:
        </p>
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Contact Created</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              A new contact record is created with all the lead's information.
            </p>
          </div>
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <Building className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Company Linked</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              If a company exists, the contact is linked. Otherwise, one is created.
            </p>
          </div>
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400">
                <DollarSign className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Deal (Optional)</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Optionally create a deal linked to the new contact immediately.
            </p>
          </div>
        </div>
      </section>

      {/* Conversion Options */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Conversion Options
        </h2>
        <div className="grid gap-4">
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Create Deal</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Check this option to create a deal at the same time. You can set the deal name,
              value, and initial stage. The deal will be automatically linked to the new contact.
            </p>
          </div>
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Transfer Activities</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              All emails, calls, tasks, and notes from the lead are transferred to the new
              contact's activity timeline, preserving the full history.
            </p>
          </div>
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Assign Owner</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              The contact (and optional deal) can be assigned to the same owner as the lead,
              or reassigned to a different team member during conversion.
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
              title: 'Qualify the Lead First',
              description: 'Make sure the lead meets your qualification criteria before converting.',
            },
            {
              title: 'Open the Lead',
              description: 'Click on the lead record to open the detail view.',
            },
            {
              title: 'Click Convert',
              description: 'Click the "Convert" button in the top action bar.',
            },
            {
              title: 'Review Information',
              description: 'Verify the contact details are correct. Edit if needed.',
            },
            {
              title: 'Configure Options',
              description: 'Choose whether to create a deal, select owner, etc.',
            },
            {
              title: 'Complete Conversion',
              description: 'Click "Convert Lead". You\'ll be taken to the new contact record.',
            },
          ]}
        />
      </section>

      {/* Tips */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Conversion Tips
        </h2>
        <div className="space-y-4">
          <QuickTip title="Check for Duplicates" type="tip">
            Before converting, search contacts to see if this person already exists.
            Merging after conversion is more work than getting it right the first time.
          </QuickTip>
          <QuickTip title="Create Deals When Ready" type="info">
            Only create a deal during conversion if there's a real sales opportunity.
            It's easy to create a deal later when the timing is right.
          </QuickTip>
          <QuickTip title="Conversion is Permanent" type="warning">
            Once converted, the lead record is archived. The data lives on in the
            contact, but you can't "unconvert" back to a lead.
          </QuickTip>
        </div>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-8">
        <Link href="/crm/learn/leads/scoring">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Previous: Lead Scoring
          </Button>
        </Link>
        <Link href="/crm/learn/leads/assignment">
          <Button className="gap-2">
            Next: Lead Assignment
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
