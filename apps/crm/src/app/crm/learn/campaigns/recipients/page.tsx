'use client';

import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import {
  ArrowLeft,
  ArrowRight,
  Users,
  Clock,
  CheckCircle,
  Filter,
  Upload,
  Tag,
  Search,
  UserMinus,
  AlertTriangle,
} from 'lucide-react';
import { AnimatedDemo, StepList, QuickTip } from '@/components/learn/AnimatedDemo';

const DEMO_STEPS = [
  {
    title: 'Open Campaign',
    description: 'Navigate to your campaign in the Campaigns module.',
    cursor: { x: 50, y: 35 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Go to Recipients Tab',
    description: 'Click on the "Recipients" tab in the campaign.',
    highlight: { x: 25, y: 15, width: 15, height: 5 },
    cursor: { x: 32, y: 17 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Add from Saved View',
    description: 'Click "Add from View" to select contacts from a filtered view.',
    highlight: { x: 15, y: 25, width: 20, height: 6 },
    cursor: { x: 25, y: 28 },
    action: 'click' as const,
    duration: 3000,
  },
  {
    title: 'Select the View',
    description: 'Choose which saved view of contacts to add.',
    highlight: { x: 25, y: 35, width: 50, height: 30 },
    cursor: { x: 50, y: 50 },
    action: 'click' as const,
    duration: 3000,
  },
  {
    title: 'Review & Confirm',
    description: 'Review the selected recipients and click "Add Recipients".',
    highlight: { x: 65, y: 70, width: 20, height: 6 },
    cursor: { x: 75, y: 73 },
    action: 'click' as const,
    duration: 2500,
  },
];

export default function RecipientsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/crm/learn" className="text-slate-500 hover:text-teal-600 transition-colors">
          Learning Center
        </Link>
        <span className="text-slate-400">/</span>
        <Link href="/crm/learn/campaigns" className="text-slate-500 hover:text-teal-600 transition-colors">
          Campaigns
        </Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-900 dark:text-white font-medium">Selecting Recipients</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-500">
          <Users className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Selecting Campaign Recipients
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Choose who receives your campaign emails using views, filters, or imports.
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
          title="Adding Campaign Recipients"
          steps={DEMO_STEPS}
        />
      </section>

      {/* Selection Methods */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Ways to Add Recipients
        </h2>
        <div className="grid gap-4">
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                <Filter className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white">From Saved View</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Select a saved view (e.g., "California Customers", "Marketing Opt-ins").
              The view's filters determine who gets added.
            </p>
          </div>
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <Tag className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white">By Tag</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Add all contacts with specific tags (e.g., "Newsletter Subscriber", "VIP").
              Great for pre-segmented lists.
            </p>
          </div>
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400">
                <Upload className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Import CSV</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Upload a CSV file with email addresses. Matching contacts are added,
              and you can optionally create new contacts.
            </p>
          </div>
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <Search className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Manual Selection</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Search and select individual contacts. Use checkboxes to add specific
              people for targeted, personalized campaigns.
            </p>
          </div>
        </div>
      </section>

      {/* Exclusion Options */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Exclusion Options
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Prevent over-emailing and respect opt-outs with these exclusion settings:
        </p>
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          {[
            { label: 'Unsubscribed Contacts', description: 'Automatically excluded from all campaigns' },
            { label: 'Contacted in Last N Days', description: 'Skip contacts who received email recently' },
            { label: 'Already in This Campaign', description: 'Prevent duplicates when adding more recipients' },
            { label: 'Missing Email Address', description: 'Contacts without valid email are skipped' },
            { label: 'Bounced Emails', description: 'Skip contacts with previous hard bounces' },
          ].map((item, index) => (
            <div
              key={item.label}
              className={`flex items-center gap-4 p-4 ${index < 4 ? 'border-b border-slate-200 dark:border-slate-700' : ''}`}
            >
              <UserMinus className="w-5 h-5 text-slate-400" />
              <div className="flex-1">
                <span className="font-medium text-slate-900 dark:text-white">{item.label}</span>
              </div>
              <span className="text-sm text-slate-500 dark:text-slate-400">{item.description}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Step by Step */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Step-by-Step Guide
        </h2>
        <StepList
          steps={[
            {
              title: 'Open Your Campaign',
              description: 'Navigate to the campaign you want to add recipients to.',
            },
            {
              title: 'Go to Recipients Tab',
              description: 'Click the "Recipients" tab in the campaign detail view.',
            },
            {
              title: 'Choose Selection Method',
              description: 'Click "Add Recipients" and choose from view, tag, CSV, or manual.',
            },
            {
              title: 'Configure Exclusions',
              description: 'Set exclusion rules to avoid over-emailing.',
            },
            {
              title: 'Preview Recipients',
              description: 'Review the list before confirming. Check total count.',
            },
            {
              title: 'Add to Campaign',
              description: 'Click "Add Recipients" to finalize the selection.',
            },
          ]}
        />
      </section>

      {/* Tips */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Recipient Selection Tips
        </h2>
        <div className="space-y-4">
          <QuickTip title="Use Saved Views" type="tip">
            Create saved views for your common segments. "Active Customers Last 90 Days"
            or "Leads from Trade Show" are easier to reuse than rebuilding filters.
          </QuickTip>
          <QuickTip title="Deduplicate Automatically" type="info">
            The system automatically removes duplicate emails. If you add from multiple
            sources, each person only receives one email.
          </QuickTip>
          <QuickTip title="Test with Small List First" type="warning">
            Before sending to thousands, test with 5-10 internal emails to verify
            content, links, and merge fields work correctly.
          </QuickTip>
        </div>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-8">
        <Link href="/crm/learn/campaigns/creating">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Previous: Creating Campaigns
          </Button>
        </Link>
        <Link href="/crm/learn/campaigns/templates">
          <Button className="gap-2">
            Next: Email Templates
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
