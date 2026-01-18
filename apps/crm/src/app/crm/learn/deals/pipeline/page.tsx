'use client';

import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import {
  ArrowLeft,
  ArrowRight,
  Target,
  Clock,
  CheckCircle,
  TrendingUp,
  DollarSign,
  Eye,
  Plus,
  GripVertical,
} from 'lucide-react';
import { AnimatedDemo, StepList, QuickTip } from '@/components/learn/AnimatedDemo';

const DEMO_STEPS = [
  {
    title: 'Navigate to Deals',
    description: 'Click on "Deals" in the main navigation to access your pipeline.',
    cursor: { x: 15, y: 12 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'View Pipeline Board',
    description: 'Your deals are displayed as cards organized by stage columns.',
    highlight: { x: 5, y: 20, width: 90, height: 60 },
    cursor: { x: 50, y: 50 },
    duration: 3000,
  },
  {
    title: 'Drag to Move Stages',
    description: 'Drag a deal card from one stage to another to update its progress.',
    highlight: { x: 15, y: 30, width: 20, height: 15 },
    cursor: { x: 25, y: 37 },
    action: 'click' as const,
    duration: 3500,
  },
  {
    title: 'View Deal Details',
    description: 'Click on any deal card to open the detail view with full information.',
    highlight: { x: 35, y: 30, width: 20, height: 15 },
    cursor: { x: 45, y: 37 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'See Stage Totals',
    description: 'Each stage shows the total value and count of deals in that stage.',
    highlight: { x: 5, y: 15, width: 90, height: 8 },
    cursor: { x: 50, y: 19 },
    duration: 3000,
  },
];

const PIPELINE_STAGES = [
  { name: 'Qualification', probability: '10%', color: 'bg-slate-500' },
  { name: 'Discovery', probability: '25%', color: 'bg-blue-500' },
  { name: 'Proposal', probability: '50%', color: 'bg-amber-500' },
  { name: 'Negotiation', probability: '75%', color: 'bg-orange-500' },
  { name: 'Closed Won', probability: '100%', color: 'bg-emerald-500' },
  { name: 'Closed Lost', probability: '0%', color: 'bg-red-500' },
];

export default function PipelineOverviewPage() {
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
        <span className="text-slate-900 dark:text-white font-medium">Pipeline Overview</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500">
          <Target className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Pipeline Overview
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Visualize your sales process with a Kanban-style pipeline board.
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
          title="Using the Pipeline Board"
          steps={DEMO_STEPS}
        />
      </section>

      {/* What is the Pipeline */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          What is the Pipeline?
        </h2>
        <div className="prose prose-slate dark:prose-invert max-w-none">
          <p className="text-slate-600 dark:text-slate-400">
            The pipeline is a visual representation of your sales process. Each column represents
            a stage in your sales cycle, and deal cards move from left to right as they progress
            toward closing. This Kanban-style view makes it easy to:
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { icon: <Eye className="w-5 h-5" />, title: 'See at a Glance', description: 'Instantly understand where all your deals stand' },
            { icon: <GripVertical className="w-5 h-5" />, title: 'Drag & Drop', description: 'Move deals between stages with a simple drag' },
            { icon: <DollarSign className="w-5 h-5" />, title: 'Track Value', description: 'See total deal value per stage and overall' },
            { icon: <TrendingUp className="w-5 h-5" />, title: 'Spot Bottlenecks', description: 'Identify where deals are getting stuck' },
          ].map((feature) => (
            <div
              key={feature.title}
              className="flex items-start gap-3 p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700"
            >
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
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

      {/* Default Stages */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Default Pipeline Stages
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          CRM Eco comes with a standard sales pipeline. Each stage has a probability percentage
          used for weighted forecasting.
        </p>
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 gap-4 p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <div className="col-span-5 text-sm font-medium text-slate-500 uppercase tracking-wider">Stage</div>
            <div className="col-span-4 text-sm font-medium text-slate-500 uppercase tracking-wider">Probability</div>
            <div className="col-span-3 text-sm font-medium text-slate-500 uppercase tracking-wider">Indicator</div>
          </div>
          {PIPELINE_STAGES.map((stage) => (
            <div key={stage.name} className="grid grid-cols-12 gap-4 p-4 items-center border-b last:border-b-0 border-slate-200 dark:border-slate-700">
              <div className="col-span-5 font-medium text-slate-900 dark:text-white">{stage.name}</div>
              <div className="col-span-4 text-slate-600 dark:text-slate-400">{stage.probability}</div>
              <div className="col-span-3">
                <div className={`w-4 h-4 rounded-full ${stage.color}`} />
              </div>
            </div>
          ))}
        </div>
        <QuickTip title="Customize Your Pipeline" type="info">
          You can rename stages, add new ones, or change probabilities in Settings → Deals → Pipeline Stages.
        </QuickTip>
      </section>

      {/* Step by Step */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Working with the Pipeline
        </h2>
        <StepList
          steps={[
            {
              title: 'Navigate to Deals',
              description: 'Click "Deals" in the main navigation. The pipeline board is the default view.',
            },
            {
              title: 'Understanding Deal Cards',
              description: 'Each card shows deal name, value, contact, and expected close date. Color indicates priority.',
            },
            {
              title: 'Move Deals Between Stages',
              description: 'Click and drag a deal card to move it to a new stage. The deal is automatically updated.',
            },
            {
              title: 'Filter Your View',
              description: 'Use the filter bar to show deals by owner, date range, value, or any custom field.',
            },
            {
              title: 'Switch to List View',
              description: 'Click the list icon in the toolbar to switch to a table view for bulk operations.',
            },
            {
              title: 'Add a New Deal',
              description: 'Click the "+ New Deal" button to create a deal. It appears in the stage you specify.',
            },
          ]}
        />
      </section>

      {/* Tips */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Pipeline Best Practices
        </h2>
        <div className="space-y-4">
          <QuickTip title="Keep It Clean" type="tip">
            Regularly review your pipeline. Close or archive stale deals that aren't progressing.
            A clean pipeline gives you accurate forecasts.
          </QuickTip>
          <QuickTip title="Use Stages Consistently" type="info">
            Define clear criteria for each stage. Everyone on your team should move deals at the
            same milestones for consistent reporting.
          </QuickTip>
          <QuickTip title="Watch Your Bottlenecks" type="warning">
            If deals are piling up in one stage, investigate why. Is the process unclear?
            Do you need more resources there?
          </QuickTip>
        </div>
      </section>

      {/* Related Articles */}
      <section className="p-6 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Related Articles</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { title: 'Creating Deals', href: '/crm/learn/deals/creating' },
            { title: 'Managing Deal Stages', href: '/crm/learn/deals/stages' },
            { title: 'Forecasting Sales', href: '/crm/learn/deals/forecasting' },
          ].map((article) => (
            <Link
              key={article.href}
              href={article.href}
              className="flex items-center gap-2 p-3 rounded-lg bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 hover:border-teal-500/50 transition-colors group"
            >
              <CheckCircle className="w-4 h-4 text-slate-400 group-hover:text-teal-500" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-teal-600 dark:group-hover:text-teal-400">
                {article.title}
              </span>
            </Link>
          ))}
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
        <Link href="/crm/learn/deals/creating">
          <Button className="gap-2">
            Next: Creating Deals
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
