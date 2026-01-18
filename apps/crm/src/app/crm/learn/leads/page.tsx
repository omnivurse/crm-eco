'use client';

import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import {
  ArrowLeft,
  ArrowRight,
  UserPlus,
  Clock,
  Play,
  CheckCircle,
  Target,
  Search,
  Filter,
  ArrowUpCircle,
  Trash2,
  Tag,
  RefreshCw,
} from 'lucide-react';
import { AnimatedDemo, StepList, QuickTip } from '@/components/learn/AnimatedDemo';

const DEMO_STEPS = [
  {
    title: 'Navigate to Leads',
    description: 'Click on "Leads" in the main navigation to view your lead list.',
    cursor: { x: 30, y: 7 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'View Lead List',
    description: 'Browse all your leads in a sortable, filterable list view.',
    highlight: { x: 22, y: 15, width: 76, height: 75 },
    cursor: { x: 50, y: 45 },
    duration: 3000,
  },
  {
    title: 'Create New Lead',
    description: 'Click the "+" button to add a new lead to your pipeline.',
    highlight: { x: 85, y: 15, width: 12, height: 7 },
    cursor: { x: 90, y: 18 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Qualify the Lead',
    description: 'Update lead status and score as you gather more information.',
    highlight: { x: 60, y: 30, width: 35, height: 20 },
    cursor: { x: 75, y: 40 },
    action: 'click' as const,
    duration: 3000,
  },
  {
    title: 'Convert to Contact',
    description: 'When ready, convert the lead to a contact and optionally create a deal.',
    highlight: { x: 70, y: 78, width: 25, height: 8 },
    cursor: { x: 82, y: 82 },
    action: 'click' as const,
    duration: 3000,
  },
];

const ARTICLES = [
  {
    title: 'Creating Leads',
    description: 'How to add new leads manually or via forms',
    time: '3 min',
    href: '/crm/learn/leads/creating',
    icon: <UserPlus className="w-5 h-5" />,
  },
  {
    title: 'Lead Qualification',
    description: 'Score and qualify leads based on criteria',
    time: '5 min',
    href: '/crm/learn/leads/qualification',
    icon: <Target className="w-5 h-5" />,
  },
  {
    title: 'Lead Conversion',
    description: 'Convert qualified leads to contacts and deals',
    time: '4 min',
    href: '/crm/learn/leads/conversion',
    icon: <ArrowUpCircle className="w-5 h-5" />,
  },
  {
    title: 'Lead Sources',
    description: 'Track where your leads come from',
    time: '3 min',
    href: '/crm/learn/leads/sources',
    icon: <RefreshCw className="w-5 h-5" />,
  },
  {
    title: 'Lead Scoring',
    description: 'Set up automatic lead scoring rules',
    time: '5 min',
    href: '/crm/learn/leads/scoring',
    icon: <Target className="w-5 h-5" />,
  },
  {
    title: 'Lead Assignment',
    description: 'Auto-assign leads to team members',
    time: '4 min',
    href: '/crm/learn/leads/assignment',
    icon: <UserPlus className="w-5 h-5" />,
  },
];

const LEAD_STATUSES = [
  { status: 'New', description: 'Fresh lead, not yet contacted', color: 'bg-blue-500' },
  { status: 'Contacted', description: 'Initial outreach made', color: 'bg-cyan-500' },
  { status: 'Qualified', description: 'Meets criteria, ready for sales', color: 'bg-emerald-500' },
  { status: 'Unqualified', description: 'Does not fit ideal customer profile', color: 'bg-slate-400' },
  { status: 'Converted', description: 'Successfully converted to contact/deal', color: 'bg-violet-500' },
];

export default function LeadsLearnPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/crm/learn" className="text-slate-500 hover:text-teal-600 transition-colors">
          Learning Center
        </Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-900 dark:text-white font-medium">Lead Management</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500">
          <UserPlus className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Lead Management
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Capture, qualify, and convert leads into customers with an efficient workflow.
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

      {/* Lead Demo */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Lead Lifecycle Overview
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Watch how leads flow through your pipeline from capture to conversion.
        </p>
        <AnimatedDemo
          title="Lead Management"
          steps={DEMO_STEPS}
        />
      </section>

      {/* Lead Status Reference */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Lead Status Guide
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Understanding lead statuses helps you track where each lead is in your sales process.
        </p>
        <div className="grid gap-3">
          {LEAD_STATUSES.map((item) => (
            <div
              key={item.status}
              className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700"
            >
              <div className={`w-3 h-3 rounded-full ${item.color}`} />
              <div className="flex-1">
                <span className="font-semibold text-slate-900 dark:text-white">
                  {item.status}
                </span>
                <span className="text-slate-500 ml-2">—</span>
                <span className="text-slate-600 dark:text-slate-400 ml-2">
                  {item.description}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Leads vs Contacts */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Leads vs. Contacts
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-500/10 dark:to-emerald-500/10 border border-green-200 dark:border-green-500/30">
            <h3 className="font-semibold text-green-800 dark:text-green-300 mb-2">
              Leads
            </h3>
            <ul className="space-y-2 text-sm text-green-700 dark:text-green-400">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Unqualified prospects
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Need nurturing & qualification
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                May or may not become customers
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Separate pipeline from contacts
              </li>
            </ul>
          </div>
          <div className="p-5 rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-500/10 dark:to-cyan-500/10 border border-blue-200 dark:border-blue-500/30">
            <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">
              Contacts
            </h3>
            <ul className="space-y-2 text-sm text-blue-700 dark:text-blue-400">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Qualified prospects or customers
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Ready for deals & opportunities
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Part of your sales pipeline
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Can be linked to accounts
              </li>
            </ul>
          </div>
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
              <div className="p-3 rounded-xl bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 group-hover:bg-teal-100 dark:group-hover:bg-teal-500/20 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
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

      {/* Conversion Workflow */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Lead Conversion Process
        </h2>
        <StepList
          steps={[
            {
              title: 'Capture the Lead',
              description: 'Add leads manually, via web forms, or import from spreadsheets.',
            },
            {
              title: 'Initial Contact',
              description: 'Reach out within 24-48 hours. First contact increases conversion rates.',
            },
            {
              title: 'Qualify the Lead',
              description: 'Determine if they fit your ideal customer profile using BANT criteria.',
            },
            {
              title: 'Nurture & Follow-up',
              description: 'Send relevant content, answer questions, and build the relationship.',
            },
            {
              title: 'Convert',
              description: 'When qualified, convert to a contact and create an associated deal.',
            },
          ]}
        />
      </section>

      {/* Best Practices */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Lead Management Tips
        </h2>
        <div className="space-y-4">
          <QuickTip title="Speed to Lead" type="tip">
            Contact new leads within 5 minutes when possible. Studies show response time
            dramatically impacts conversion rates. Set up notifications for new leads.
          </QuickTip>
          <QuickTip title="Use Lead Scoring" type="info">
            Set up automatic lead scoring based on engagement, demographics, and behavior.
            Focus your time on high-score leads most likely to convert.
          </QuickTip>
          <QuickTip title="Don't Delete Unqualified Leads" type="warning">
            Instead of deleting, mark as "Unqualified" with a reason. Circumstances change,
            and you may want to re-engage these leads later.
          </QuickTip>
        </div>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-8">
        <Link href="/crm/learn/contacts">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Previous: Contacts
          </Button>
        </Link>
        <Link href="/crm/learn/deals">
          <Button className="gap-2">
            Next: Deals & Pipeline
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
