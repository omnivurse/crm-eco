'use client';

import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Clock,
  CheckCircle,
  Mail,
  Eye,
  MousePointer,
  AlertTriangle,
  UserMinus,
  TrendingUp,
  Percent,
} from 'lucide-react';
import { AnimatedDemo, StepList, QuickTip } from '@/components/learn/AnimatedDemo';

const DEMO_STEPS = [
  {
    title: 'Open Campaign',
    description: 'Click on a sent campaign to view its performance.',
    cursor: { x: 50, y: 40 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'View Overview Metrics',
    description: 'See key metrics: sent, delivered, opens, clicks, bounces.',
    highlight: { x: 15, y: 20, width: 70, height: 20 },
    cursor: { x: 50, y: 30 },
    duration: 3500,
  },
  {
    title: 'Check Engagement Over Time',
    description: 'View the chart showing opens and clicks over time.',
    highlight: { x: 15, y: 45, width: 70, height: 25 },
    cursor: { x: 50, y: 57 },
    duration: 3000,
  },
  {
    title: 'See Top Links',
    description: 'Review which links received the most clicks.',
    highlight: { x: 15, y: 72, width: 35, height: 18 },
    cursor: { x: 32, y: 81 },
    duration: 2500,
  },
  {
    title: 'Filter by Status',
    description: 'Click status filters to see specific recipients.',
    highlight: { x: 55, y: 72, width: 30, height: 18 },
    cursor: { x: 70, y: 81 },
    action: 'click' as const,
    duration: 2500,
  },
];

const METRICS = [
  {
    icon: <Mail className="w-5 h-5" />,
    name: 'Delivery Rate',
    formula: '(Delivered ÷ Sent) × 100',
    benchmark: '95%+ is good',
    color: 'blue',
  },
  {
    icon: <Eye className="w-5 h-5" />,
    name: 'Open Rate',
    formula: '(Unique Opens ÷ Delivered) × 100',
    benchmark: '20-30% is average',
    color: 'emerald',
  },
  {
    icon: <MousePointer className="w-5 h-5" />,
    name: 'Click Rate',
    formula: '(Unique Clicks ÷ Delivered) × 100',
    benchmark: '2-5% is average',
    color: 'violet',
  },
  {
    icon: <AlertTriangle className="w-5 h-5" />,
    name: 'Bounce Rate',
    formula: '(Bounced ÷ Sent) × 100',
    benchmark: 'Under 2% is healthy',
    color: 'amber',
  },
  {
    icon: <UserMinus className="w-5 h-5" />,
    name: 'Unsubscribe Rate',
    formula: '(Unsubscribes ÷ Delivered) × 100',
    benchmark: 'Under 0.5% is normal',
    color: 'red',
  },
];

export default function AnalyticsPage() {
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
        <span className="text-slate-900 dark:text-white font-medium">Tracking & Analytics</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500">
          <BarChart3 className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Campaign Tracking & Analytics
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Measure campaign performance with detailed open, click, and engagement metrics.
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
          title="Viewing Campaign Analytics"
          steps={DEMO_STEPS}
        />
      </section>

      {/* Key Metrics */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Key Metrics Explained
        </h2>
        <div className="grid gap-4">
          {METRICS.map((metric) => (
            <div
              key={metric.name}
              className="flex items-start gap-4 p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700"
            >
              <div className={`p-3 rounded-lg ${
                metric.color === 'blue' ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400' :
                metric.color === 'emerald' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
                metric.color === 'violet' ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400' :
                metric.color === 'amber' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400' :
                'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'
              }`}>
                {metric.icon}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-1">{metric.name}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                  <code className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs">{metric.formula}</code>
                </p>
                <p className="text-sm text-slate-500">{metric.benchmark}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How Tracking Works */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          How Tracking Works
        </h2>
        <div className="grid gap-4">
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <Eye className="w-5 h-5 text-emerald-500" />
              <h3 className="font-semibold text-slate-900 dark:text-white">Open Tracking</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              A tiny invisible image (tracking pixel) is embedded in each email. When the recipient's
              email client loads images, it registers as an open. Note: Some clients block images,
              so actual opens may be higher.
            </p>
          </div>
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <MousePointer className="w-5 h-5 text-violet-500" />
              <h3 className="font-semibold text-slate-900 dark:text-white">Click Tracking</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              All links are rewritten to pass through our tracking server. When clicked, we record
              the click and redirect to the original URL. This lets us track which links get
              the most engagement.
            </p>
          </div>
        </div>
      </section>

      {/* Step by Step */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Analyzing Your Campaign
        </h2>
        <StepList
          steps={[
            {
              title: 'Wait for Data',
              description: 'Give it 24-48 hours after sending for meaningful data to accumulate.',
            },
            {
              title: 'Check Delivery First',
              description: 'High bounce rate? Check for invalid emails or list quality issues.',
            },
            {
              title: 'Review Open Rate',
              description: 'Low opens? Test different subject lines next time.',
            },
            {
              title: 'Analyze Click Patterns',
              description: 'See which links perform best. Put key CTAs where they get clicked.',
            },
            {
              title: 'Follow Up on Engaged',
              description: 'Create a view of contacts who clicked. They showed interest!',
            },
            {
              title: 'Learn and Iterate',
              description: 'Apply learnings to your next campaign for continuous improvement.',
            },
          ]}
        />
      </section>

      {/* Tips */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Analytics Tips
        </h2>
        <div className="space-y-4">
          <QuickTip title="Compare to Benchmarks" type="tip">
            Don't measure in isolation. Compare to industry benchmarks and your own
            historical performance to understand if results are good.
          </QuickTip>
          <QuickTip title="Open Rate Limitations" type="info">
            Apple Mail Privacy Protection can inflate open rates. Focus on click rate
            as a more reliable engagement metric.
          </QuickTip>
          <QuickTip title="Clean Your List" type="warning">
            High bounce rates hurt your sender reputation. Regularly remove invalid
            emails and re-confirm old subscribers.
          </QuickTip>
        </div>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-8">
        <Link href="/crm/learn/campaigns/templates">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Previous: Email Templates
          </Button>
        </Link>
        <Link href="/crm/learn/sequences">
          <Button className="gap-2">
            Next: Email Sequences
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
