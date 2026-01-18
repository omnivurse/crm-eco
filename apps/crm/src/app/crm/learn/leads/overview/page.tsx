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
  Target,
  TrendingUp,
  ArrowRightLeft,
  Filter,
} from 'lucide-react';
import { AnimatedDemo, StepList, QuickTip } from '@/components/learn/AnimatedDemo';

const DEMO_STEPS = [
  {
    title: 'Navigate to Leads',
    description: 'Click "Leads" in the main navigation sidebar.',
    cursor: { x: 8, y: 25 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'View Lead List',
    description: 'See all your leads in a sortable, filterable list.',
    highlight: { x: 15, y: 20, width: 80, height: 60 },
    cursor: { x: 55, y: 50 },
    duration: 3000,
  },
  {
    title: 'Filter by Status',
    description: 'Use the status filter to see leads at different stages.',
    highlight: { x: 15, y: 12, width: 20, height: 5 },
    cursor: { x: 25, y: 14 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Open Lead Detail',
    description: 'Click any lead to view full details and activity history.',
    highlight: { x: 15, y: 30, width: 80, height: 10 },
    cursor: { x: 55, y: 35 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Create New Lead',
    description: 'Click "+ New Lead" to manually create a lead.',
    highlight: { x: 80, y: 10, width: 15, height: 5 },
    cursor: { x: 87, y: 12 },
    action: 'click' as const,
    duration: 2500,
  },
];

export default function LeadsOverviewPage() {
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
        <span className="text-slate-900 dark:text-white font-medium">Understanding Leads</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500">
          <UserPlus className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Understanding Leads
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Learn how leads differ from contacts and how to manage them effectively.
          </p>
          <div className="flex items-center gap-4 mt-4 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              4 min read
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
          title="Leads Overview"
          steps={DEMO_STEPS}
        />
      </section>

      {/* What is a Lead */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          What is a Lead?
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          A lead is a potential customer who has shown interest but hasn't been qualified yet.
          Leads are separate from contacts to help you focus your sales efforts.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="p-5 rounded-xl bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/30">
            <h3 className="font-semibold text-violet-800 dark:text-violet-300 mb-2">Leads</h3>
            <ul className="text-sm text-violet-700 dark:text-violet-400 space-y-1">
              <li>• Unqualified prospects</li>
              <li>• May or may not become customers</li>
              <li>• Need nurturing and qualification</li>
              <li>• Converted to contacts when ready</li>
            </ul>
          </div>
          <div className="p-5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
            <h3 className="font-semibold text-emerald-800 dark:text-emerald-300 mb-2">Contacts</h3>
            <ul className="text-sm text-emerald-700 dark:text-emerald-400 space-y-1">
              <li>• Qualified individuals</li>
              <li>• Established relationships</li>
              <li>• Can be associated with deals</li>
              <li>• Part of your customer database</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Lead Lifecycle */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Lead Lifecycle
        </h2>
        <div className="flex flex-col sm:flex-row items-center gap-4 p-6 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
          {[
            { icon: <UserPlus className="w-6 h-6" />, label: 'New Lead', color: 'bg-blue-500' },
            { icon: <Filter className="w-6 h-6" />, label: 'Qualify', color: 'bg-amber-500' },
            { icon: <ArrowRightLeft className="w-6 h-6" />, label: 'Convert', color: 'bg-emerald-500' },
            { icon: <Users className="w-6 h-6" />, label: 'Contact', color: 'bg-violet-500' },
          ].map((step, index) => (
            <div key={step.label} className="flex items-center gap-4">
              <div className="flex flex-col items-center">
                <div className={`p-3 rounded-full ${step.color} text-white mb-2`}>
                  {step.icon}
                </div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{step.label}</span>
              </div>
              {index < 3 && (
                <ArrowRight className="w-5 h-5 text-slate-300 dark:text-slate-600 hidden sm:block" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Lead Statuses */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Lead Statuses
        </h2>
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          {[
            { status: 'New', description: 'Just captured, not yet contacted', color: 'bg-blue-500' },
            { status: 'Contacted', description: 'Initial outreach has been made', color: 'bg-cyan-500' },
            { status: 'Qualified', description: 'Meets criteria, ready for conversion', color: 'bg-emerald-500' },
            { status: 'Unqualified', description: 'Does not meet criteria', color: 'bg-slate-500' },
            { status: 'Converted', description: 'Successfully converted to contact', color: 'bg-violet-500' },
          ].map((item, index) => (
            <div
              key={item.status}
              className={`flex items-center gap-4 p-4 ${index < 4 ? 'border-b border-slate-200 dark:border-slate-700' : ''}`}
            >
              <div className={`w-3 h-3 rounded-full ${item.color}`} />
              <div className="flex-1">
                <span className="font-medium text-slate-900 dark:text-white">{item.status}</span>
              </div>
              <span className="text-sm text-slate-500 dark:text-slate-400">{item.description}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Step by Step */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Working with Leads
        </h2>
        <StepList
          steps={[
            {
              title: 'Capture Leads',
              description: 'Leads come from web forms, imports, manual entry, or integrations.',
            },
            {
              title: 'Assign Ownership',
              description: 'Route leads to sales reps based on territory, round-robin, or manual assignment.',
            },
            {
              title: 'Qualify the Lead',
              description: 'Research and contact the lead to determine if they are a good fit.',
            },
            {
              title: 'Update Status',
              description: 'Move leads through statuses as you learn more about them.',
            },
            {
              title: 'Convert or Close',
              description: 'Convert qualified leads to contacts (and optionally deals), or mark as unqualified.',
            },
          ]}
        />
      </section>

      {/* Tips */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Lead Management Tips
        </h2>
        <div className="space-y-4">
          <QuickTip title="Speed Matters" type="tip">
            Contact new leads within 5 minutes for best conversion rates.
            Use automation to send immediate follow-up emails.
          </QuickTip>
          <QuickTip title="Define Qualification Criteria" type="info">
            Document what makes a lead qualified (budget, authority, need, timeline).
            This ensures consistency across your team.
          </QuickTip>
          <QuickTip title="Don't Let Leads Go Stale" type="warning">
            Set up reminders for leads that haven't been touched in a while.
            Regularly review and clean up your lead database.
          </QuickTip>
        </div>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-8">
        <Link href="/crm/learn/leads">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Leads
          </Button>
        </Link>
        <Link href="/crm/learn/leads/scoring">
          <Button className="gap-2">
            Next: Lead Scoring
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
