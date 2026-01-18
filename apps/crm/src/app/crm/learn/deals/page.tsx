'use client';

import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import {
  ArrowLeft,
  ArrowRight,
  Target,
  Clock,
  Play,
  CheckCircle,
  DollarSign,
  Kanban,
  TrendingUp,
  Calendar,
  Users,
  FileText,
  BarChart3,
} from 'lucide-react';
import { AnimatedDemo, StepList, QuickTip } from '@/components/learn/AnimatedDemo';

const DEMO_STEPS = [
  {
    title: 'Open Deals Module',
    description: 'Click "Deals" in the navigation to view your sales pipeline.',
    cursor: { x: 40, y: 7 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Pipeline View',
    description: 'See all your deals organized by stage in the Kanban board.',
    highlight: { x: 5, y: 15, width: 90, height: 75 },
    cursor: { x: 50, y: 50 },
    duration: 3500,
  },
  {
    title: 'Create New Deal',
    description: 'Click "New Deal" to add an opportunity to your pipeline.',
    highlight: { x: 80, y: 8, width: 18, height: 6 },
    cursor: { x: 88, y: 11 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Move Through Stages',
    description: 'Drag and drop deals between stages as they progress.',
    highlight: { x: 25, y: 25, width: 20, height: 30 },
    cursor: { x: 35, y: 40 },
    action: 'click' as const,
    duration: 3000,
  },
  {
    title: 'Close the Deal',
    description: 'Move to "Won" or "Lost" to close the deal and record the outcome.',
    highlight: { x: 75, y: 25, width: 20, height: 30 },
    cursor: { x: 85, y: 40 },
    action: 'click' as const,
    duration: 3000,
  },
];

const ARTICLES = [
  {
    title: 'Creating Deals',
    description: 'How to create and configure new deals',
    time: '4 min',
    href: '/crm/learn/deals/creating',
    icon: <Target className="w-5 h-5" />,
  },
  {
    title: 'Pipeline Stages',
    description: 'Customize your sales pipeline stages',
    time: '5 min',
    href: '/crm/learn/deals/pipeline',
    icon: <Kanban className="w-5 h-5" />,
  },
  {
    title: 'Deal Forecasting',
    description: 'Predict revenue with probability-weighted forecasts',
    time: '5 min',
    href: '/crm/learn/deals/forecasting',
    icon: <TrendingUp className="w-5 h-5" />,
  },
  {
    title: 'Expected Close Dates',
    description: 'Track and manage deal timelines',
    time: '3 min',
    href: '/crm/learn/deals/close-dates',
    icon: <Calendar className="w-5 h-5" />,
  },
  {
    title: 'Deal Contacts & Roles',
    description: 'Associate contacts with specific roles in deals',
    time: '4 min',
    href: '/crm/learn/deals/contacts',
    icon: <Users className="w-5 h-5" />,
  },
  {
    title: 'Quotes & Proposals',
    description: 'Generate quotes from deal information',
    time: '5 min',
    href: '/crm/learn/deals/quotes',
    icon: <FileText className="w-5 h-5" />,
  },
];

const PIPELINE_STAGES = [
  { stage: 'Qualification', probability: '10%', description: 'Initial discovery and needs assessment', color: 'bg-slate-400' },
  { stage: 'Needs Analysis', probability: '25%', description: 'Understanding requirements in depth', color: 'bg-blue-400' },
  { stage: 'Proposal', probability: '50%', description: 'Presenting solution and pricing', color: 'bg-cyan-400' },
  { stage: 'Negotiation', probability: '75%', description: 'Finalizing terms and conditions', color: 'bg-amber-400' },
  { stage: 'Closed Won', probability: '100%', description: 'Deal successfully closed', color: 'bg-emerald-500' },
  { stage: 'Closed Lost', probability: '0%', description: 'Deal did not close', color: 'bg-red-400' },
];

export default function DealsLearnPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/crm/learn" className="text-slate-500 hover:text-teal-600 transition-colors">
          Learning Center
        </Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-900 dark:text-white font-medium">Deals & Pipeline</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500">
          <Target className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Deals & Pipeline
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Track opportunities through your sales pipeline from qualification to close.
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

      {/* Pipeline Demo */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Working with Your Pipeline
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          See how to navigate and manage deals in your sales pipeline.
        </p>
        <AnimatedDemo
          title="Sales Pipeline"
          steps={DEMO_STEPS}
        />
      </section>

      {/* Pipeline Stages */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Default Pipeline Stages
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Each stage represents a step in your sales process with an associated win probability.
        </p>
        <div className="space-y-2">
          {PIPELINE_STAGES.map((item, index) => (
            <div
              key={item.stage}
              className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700"
            >
              <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm font-semibold text-slate-600 dark:text-slate-400">
                {index + 1}
              </div>
              <div className={`w-3 h-3 rounded-full ${item.color}`} />
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {item.stage}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {item.probability}
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Key Metrics */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-500/10 dark:to-green-500/10 border border-emerald-200 dark:border-emerald-500/30">
          <div className="flex items-center gap-3 mb-3">
            <DollarSign className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            <span className="font-semibold text-slate-900 dark:text-white">Deal Value</span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Track the monetary value of each opportunity to prioritize high-value deals.
          </p>
        </div>
        <div className="p-5 rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-500/10 dark:to-purple-500/10 border border-violet-200 dark:border-violet-500/30">
          <div className="flex items-center gap-3 mb-3">
            <TrendingUp className="w-6 h-6 text-violet-600 dark:text-violet-400" />
            <span className="font-semibold text-slate-900 dark:text-white">Win Probability</span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Each stage has a probability percentage used to calculate weighted pipeline value.
          </p>
        </div>
        <div className="p-5 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 border border-amber-200 dark:border-amber-500/30">
          <div className="flex items-center gap-3 mb-3">
            <BarChart3 className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            <span className="font-semibold text-slate-900 dark:text-white">Forecast</span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Weighted forecast = Deal Value × Win Probability. Predict future revenue accurately.
          </p>
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
              <div className="p-3 rounded-xl bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 group-hover:bg-teal-100 dark:group-hover:bg-teal-500/20 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
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

      {/* Deal Workflow */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Deal Management Workflow
        </h2>
        <StepList
          steps={[
            {
              title: 'Create the Deal',
              description: 'Add opportunity with value, expected close date, and associated contact.',
            },
            {
              title: 'Qualify the Opportunity',
              description: 'Confirm budget, authority, need, and timeline (BANT) criteria.',
            },
            {
              title: 'Present Your Solution',
              description: 'Demo your product, share proposals, and address objections.',
            },
            {
              title: 'Negotiate Terms',
              description: 'Work through pricing, contracts, and implementation details.',
            },
            {
              title: 'Close & Document',
              description: 'Mark as Won or Lost. Record close reason for future learning.',
            },
          ]}
        />
      </section>

      {/* Best Practices */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Pipeline Best Practices
        </h2>
        <div className="space-y-4">
          <QuickTip title="Keep Your Pipeline Clean" type="tip">
            Review your pipeline weekly. Move stale deals to Lost or update their close dates.
            An accurate pipeline gives you better forecasting.
          </QuickTip>
          <QuickTip title="Use Expected Close Dates" type="info">
            Always set realistic close dates. This helps with resource planning and
            identifies deals that need attention when they slip.
          </QuickTip>
          <QuickTip title="Document Lost Reasons" type="warning">
            When closing a deal as Lost, always record why. Common patterns in lost reasons
            reveal areas for improvement in your sales process.
          </QuickTip>
        </div>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-8">
        <Link href="/crm/learn/leads">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Previous: Lead Management
          </Button>
        </Link>
        <Link href="/crm/learn/campaigns">
          <Button className="gap-2">
            Next: Email Campaigns
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
