'use client';

import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import {
  ArrowLeft,
  ArrowRight,
  Target,
  Clock,
  CheckCircle,
  Plus,
  DollarSign,
  Calendar,
  User,
  Users,
  Building,
  FileText,
  Percent,
} from 'lucide-react';
import { AnimatedDemo, StepList, QuickTip } from '@/components/learn/AnimatedDemo';

const DEMO_STEPS = [
  {
    title: 'Click the + Button',
    description: 'Click the "+" button in the top navigation to open the create menu.',
    cursor: { x: 90, y: 6 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Select "Deal"',
    description: 'Choose "Deal" from the dropdown to open the deal creation form.',
    highlight: { x: 75, y: 10, width: 20, height: 20 },
    cursor: { x: 85, y: 18 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Enter Deal Name',
    description: 'Give your deal a descriptive name, like "Acme Corp - Enterprise License".',
    highlight: { x: 25, y: 20, width: 50, height: 10 },
    cursor: { x: 50, y: 25 },
    action: 'type' as const,
    duration: 3000,
  },
  {
    title: 'Set Deal Value',
    description: 'Enter the potential value of this deal in your currency.',
    highlight: { x: 25, y: 32, width: 25, height: 10 },
    cursor: { x: 37, y: 37 },
    action: 'type' as const,
    duration: 2500,
  },
  {
    title: 'Choose Pipeline Stage',
    description: 'Select the current stage of this deal in your sales pipeline.',
    highlight: { x: 50, y: 32, width: 25, height: 10 },
    cursor: { x: 62, y: 37 },
    action: 'click' as const,
    duration: 3000,
  },
  {
    title: 'Set Expected Close Date',
    description: 'When do you expect this deal to close? Set a realistic date.',
    highlight: { x: 25, y: 44, width: 25, height: 10 },
    cursor: { x: 37, y: 49 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Link Contact & Account',
    description: 'Associate the deal with a contact and their company.',
    highlight: { x: 25, y: 56, width: 50, height: 12 },
    cursor: { x: 50, y: 62 },
    action: 'click' as const,
    duration: 3000,
  },
  {
    title: 'Save the Deal',
    description: 'Click "Save" to create the deal. It will appear in your pipeline.',
    highlight: { x: 55, y: 80, width: 20, height: 8 },
    cursor: { x: 65, y: 84 },
    action: 'click' as const,
    duration: 2500,
  },
];

const DEAL_FIELDS = [
  { field: 'Deal Name', icon: <FileText className="w-4 h-4" />, required: true, description: 'Descriptive name for the opportunity' },
  { field: 'Value', icon: <DollarSign className="w-4 h-4" />, required: true, description: 'Potential revenue amount' },
  { field: 'Stage', icon: <Target className="w-4 h-4" />, required: true, description: 'Current pipeline stage' },
  { field: 'Close Date', icon: <Calendar className="w-4 h-4" />, required: false, description: 'Expected close date' },
  { field: 'Contact', icon: <User className="w-4 h-4" />, required: false, description: 'Primary contact for the deal' },
  { field: 'Account', icon: <Building className="w-4 h-4" />, required: false, description: 'Company/organization' },
  { field: 'Owner', icon: <Users className="w-4 h-4" />, required: false, description: 'Sales rep responsible' },
  { field: 'Probability', icon: <Percent className="w-4 h-4" />, required: false, description: 'Auto-set by stage' },
];

export default function CreatingDealsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/crm/learn" className="text-slate-500 hover:text-teal-600 transition-colors">
          Learning Center
        </Link>
        <span className="text-slate-400">/</span>
        <Link href="/crm/learn/deals" className="text-slate-500 hover:text-teal-600 transition-colors">
          Deals
        </Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-900 dark:text-white font-medium">Creating Deals</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500">
          <Plus className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Creating Deals
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Learn how to add sales opportunities to your pipeline.
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
          Video Walkthrough
        </h2>
        <AnimatedDemo
          title="Creating a Deal"
          steps={DEMO_STEPS}
        />
      </section>

      {/* What is a Deal */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          What is a Deal?
        </h2>
        <div className="p-6 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            A <strong>Deal</strong> (also called an Opportunity) represents a potential sale that you're
            working to close. Deals move through your sales pipeline from initial qualification to
            either "Won" (closed successfully) or "Lost" (didn't close).
          </p>
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="text-center p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
              <DollarSign className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
              <span className="text-sm font-medium text-slate-900 dark:text-white">Track Value</span>
            </div>
            <div className="text-center p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
              <Target className="w-8 h-8 mx-auto mb-2 text-violet-500" />
              <span className="text-sm font-medium text-slate-900 dark:text-white">Monitor Progress</span>
            </div>
            <div className="text-center p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
              <Calendar className="w-8 h-8 mx-auto mb-2 text-blue-500" />
              <span className="text-sm font-medium text-slate-900 dark:text-white">Forecast Revenue</span>
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
              title: 'Open the Create Menu',
              description: 'Click the "+" button in the navigation bar, or press ⌘+N (Ctrl+N on Windows).',
            },
            {
              title: 'Select "Deal"',
              description: 'Choose "Deal" from the dropdown menu to open the deal creation form.',
            },
            {
              title: 'Enter a Deal Name',
              description: 'Use a descriptive name like "Company Name - Product/Service". This helps identify deals at a glance.',
            },
            {
              title: 'Set the Deal Value',
              description: 'Enter the potential revenue. This is used for forecasting and pipeline value calculations.',
            },
            {
              title: 'Select Pipeline Stage',
              description: 'Choose the appropriate stage based on where you are in the sales process. Each stage has a probability percentage.',
            },
            {
              title: 'Set Expected Close Date',
              description: 'When do you realistically expect to close this deal? This helps with forecasting and prioritization.',
            },
            {
              title: 'Link Contact and Account',
              description: 'Associate the deal with the primary contact and their company. This creates a relationship you can reference later.',
            },
            {
              title: 'Save',
              description: 'Click "Save" to create the deal. It will appear in your pipeline at the selected stage.',
            },
          ]}
        />
      </section>

      {/* Field Reference */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Deal Fields
        </h2>
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 font-medium text-sm text-slate-600 dark:text-slate-400">
            <div className="col-span-4">Field</div>
            <div className="col-span-2 text-center">Required</div>
            <div className="col-span-6">Description</div>
          </div>
          {DEAL_FIELDS.map((item, index) => (
            <div
              key={item.field}
              className={`grid grid-cols-12 gap-4 p-4 items-center ${
                index < DEAL_FIELDS.length - 1 ? 'border-b border-slate-200 dark:border-slate-700' : ''
              }`}
            >
              <div className="col-span-4 flex items-center gap-2">
                <span className="text-slate-400">{item.icon}</span>
                <span className="font-medium text-slate-900 dark:text-white">{item.field}</span>
              </div>
              <div className="col-span-2 text-center">
                {item.required ? (
                  <span className="text-xs px-2 py-0.5 rounded bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400">
                    Yes
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500">
                    No
                  </span>
                )}
              </div>
              <div className="col-span-6 text-sm text-slate-600 dark:text-slate-400">
                {item.description}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Deal Naming Conventions */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Deal Naming Best Practices
        </h2>
        <div className="grid gap-3">
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span className="font-semibold text-emerald-800 dark:text-emerald-300">Good Examples</span>
            </div>
            <ul className="text-sm text-emerald-700 dark:text-emerald-400 space-y-1 ml-7">
              <li>Acme Corp - Enterprise License (50 seats)</li>
              <li>TechStart Inc - Annual Subscription</li>
              <li>Global Solutions - Q1 Renewal</li>
            </ul>
          </div>
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-5 h-5 text-red-600 dark:text-red-400 flex items-center justify-center font-bold">✕</span>
              <span className="font-semibold text-red-800 dark:text-red-300">Avoid These</span>
            </div>
            <ul className="text-sm text-red-700 dark:text-red-400 space-y-1 ml-7">
              <li>New deal</li>
              <li>John's opportunity</li>
              <li>Big one!!!</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Tips */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Tips & Best Practices
        </h2>
        <div className="space-y-4">
          <QuickTip title="Be Realistic with Values" type="tip">
            Enter the actual expected value, not an optimistic number. Accurate values
            lead to better forecasting and decision-making.
          </QuickTip>
          <QuickTip title="Update Close Dates" type="info">
            If a deal slips, update the expected close date immediately. This keeps your
            forecast accurate and helps prioritize follow-ups.
          </QuickTip>
          <QuickTip title="Always Link to Contacts" type="warning">
            Deals without contacts are harder to track. Always associate at least one
            contact so you know who to communicate with.
          </QuickTip>
        </div>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-8">
        <Link href="/crm/learn/deals">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Deals
          </Button>
        </Link>
        <Link href="/crm/learn/deals/pipeline">
          <Button className="gap-2">
            Next: Pipeline Stages
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
