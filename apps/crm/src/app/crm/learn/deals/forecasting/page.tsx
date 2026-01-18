'use client';

import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import {
  ArrowLeft,
  ArrowRight,
  TrendingUp,
  Clock,
  CheckCircle,
  DollarSign,
  Calendar,
  BarChart3,
  Calculator,
  Target,
} from 'lucide-react';
import { AnimatedDemo, StepList, QuickTip } from '@/components/learn/AnimatedDemo';

const DEMO_STEPS = [
  {
    title: 'Navigate to Reports',
    description: 'Click "Reports" in the main navigation to access forecasting.',
    cursor: { x: 15, y: 12 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Select Sales Forecast',
    description: 'Click on "Sales Forecast" from the report templates.',
    cursor: { x: 30, y: 35 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Set Date Range',
    description: 'Choose the forecast period: this month, quarter, or year.',
    highlight: { x: 60, y: 15, width: 30, height: 8 },
    cursor: { x: 75, y: 19 },
    action: 'click' as const,
    duration: 3000,
  },
  {
    title: 'View Weighted Forecast',
    description: 'See the weighted total based on deal values and stage probabilities.',
    highlight: { x: 10, y: 30, width: 80, height: 25 },
    cursor: { x: 50, y: 42 },
    duration: 3500,
  },
  {
    title: 'Drill Down by Stage',
    description: 'Click on any stage to see the deals contributing to that forecast.',
    highlight: { x: 10, y: 60, width: 80, height: 30 },
    cursor: { x: 50, y: 75 },
    action: 'click' as const,
    duration: 3000,
  },
];

const FORECAST_EXAMPLE = [
  { stage: 'Qualification', value: '$50,000', probability: '10%', weighted: '$5,000' },
  { stage: 'Discovery', value: '$80,000', probability: '25%', weighted: '$20,000' },
  { stage: 'Proposal', value: '$120,000', probability: '50%', weighted: '$60,000' },
  { stage: 'Negotiation', value: '$45,000', probability: '75%', weighted: '$33,750' },
];

export default function ForecastingPage() {
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
        <span className="text-slate-900 dark:text-white font-medium">Forecasting Sales</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500">
          <TrendingUp className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Forecasting Sales
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Predict future revenue using weighted forecasting based on pipeline data.
          </p>
          <div className="flex items-center gap-4 mt-4 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              5 min read
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
          title="Using Sales Forecasting"
          steps={DEMO_STEPS}
        />
      </section>

      {/* How It Works */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          How Forecasting Works
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          CRM Eco uses weighted forecasting to predict your expected revenue. The formula is simple:
        </p>
        <div className="p-6 rounded-xl bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-500/10 dark:to-purple-500/10 border border-violet-200 dark:border-violet-500/30">
          <div className="flex items-center justify-center gap-4 text-lg font-mono">
            <span className="text-slate-700 dark:text-slate-300">Weighted Value</span>
            <span className="text-violet-500">=</span>
            <span className="text-slate-700 dark:text-slate-300">Deal Value</span>
            <span className="text-violet-500">×</span>
            <span className="text-slate-700 dark:text-slate-300">Stage Probability</span>
          </div>
        </div>
        <p className="text-slate-600 dark:text-slate-400">
          For example, a $100,000 deal at a stage with 50% probability contributes $50,000 to your forecast.
          The total forecast is the sum of all weighted values.
        </p>
      </section>

      {/* Example Table */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Forecast Example
        </h2>
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="grid grid-cols-4 gap-4 p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <div className="text-sm font-medium text-slate-500 uppercase tracking-wider">Stage</div>
            <div className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Value</div>
            <div className="text-sm font-medium text-slate-500 uppercase tracking-wider">Probability</div>
            <div className="text-sm font-medium text-slate-500 uppercase tracking-wider">Weighted</div>
          </div>
          {FORECAST_EXAMPLE.map((row) => (
            <div key={row.stage} className="grid grid-cols-4 gap-4 p-4 border-b last:border-b-0 border-slate-200 dark:border-slate-700">
              <div className="font-medium text-slate-900 dark:text-white">{row.stage}</div>
              <div className="text-slate-600 dark:text-slate-400">{row.value}</div>
              <div className="text-slate-600 dark:text-slate-400">{row.probability}</div>
              <div className="font-semibold text-emerald-600 dark:text-emerald-400">{row.weighted}</div>
            </div>
          ))}
          <div className="grid grid-cols-4 gap-4 p-4 bg-slate-50 dark:bg-slate-800/50">
            <div className="col-span-3 text-right font-semibold text-slate-900 dark:text-white">
              Total Weighted Forecast:
            </div>
            <div className="font-bold text-lg text-emerald-600 dark:text-emerald-400">$118,750</div>
          </div>
        </div>
      </section>

      {/* Forecast Types */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Types of Forecasts
        </h2>
        <div className="grid gap-4">
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <Calculator className="w-5 h-5 text-violet-500" />
              <h3 className="font-semibold text-slate-900 dark:text-white">Weighted Forecast</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              The most realistic view. Multiplies each deal by its stage probability.
              Best for predicting actual revenue.
            </p>
          </div>
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <Target className="w-5 h-5 text-amber-500" />
              <h3 className="font-semibold text-slate-900 dark:text-white">Best Case</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Total value of all open deals. Assumes you close everything.
              Useful for understanding maximum potential.
            </p>
          </div>
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-5 h-5 text-emerald-500" />
              <h3 className="font-semibold text-slate-900 dark:text-white">Committed</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Only deals in late stages (e.g., 75%+ probability).
              Conservative estimate of deals most likely to close.
            </p>
          </div>
        </div>
      </section>

      {/* Step by Step */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Viewing Your Forecast
        </h2>
        <StepList
          steps={[
            {
              title: 'Go to Reports',
              description: 'Navigate to Reports from the main menu.',
            },
            {
              title: 'Select Sales Forecast',
              description: 'Choose the "Sales Forecast" report from the list.',
            },
            {
              title: 'Set Your Date Range',
              description: 'Select the period you want to forecast: this month, quarter, or custom range.',
            },
            {
              title: 'Filter by Owner or Team',
              description: 'Optionally filter to see forecasts for specific sales reps or teams.',
            },
            {
              title: 'Review the Numbers',
              description: 'View weighted forecast, best case, and committed amounts.',
            },
            {
              title: 'Drill Down',
              description: 'Click on any stage or category to see the underlying deals.',
            },
          ]}
        />
      </section>

      {/* Tips */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Forecasting Best Practices
        </h2>
        <div className="space-y-4">
          <QuickTip title="Keep Data Current" type="tip">
            Forecasts are only as good as your data. Update deal values and stages regularly
            to maintain accurate predictions.
          </QuickTip>
          <QuickTip title="Calibrate Probabilities" type="info">
            Review your actual win rates by stage quarterly. Adjust stage probabilities
            to match reality for more accurate forecasts.
          </QuickTip>
          <QuickTip title="Use Expected Close Dates" type="warning">
            Make sure deals have realistic expected close dates. Deals with no date or
            past dates may skew your forecast timeline.
          </QuickTip>
        </div>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-8">
        <Link href="/crm/learn/deals/stages">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Previous: Managing Stages
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
