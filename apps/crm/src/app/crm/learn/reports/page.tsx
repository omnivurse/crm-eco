'use client';

import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Clock,
  Play,
  CheckCircle,
  PieChart,
  TrendingUp,
  LineChart,
  Table,
  Download,
  Calendar,
  Filter,
  Share2,
} from 'lucide-react';
import { AnimatedDemo, StepList, QuickTip } from '@/components/learn/AnimatedDemo';

const DEMO_STEPS = [
  {
    title: 'Open Reports',
    description: 'Navigate to Reports in the main navigation to view analytics.',
    cursor: { x: 50, y: 7 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Browse Report Library',
    description: 'View pre-built reports or create custom ones.',
    highlight: { x: 5, y: 15, width: 25, height: 75 },
    cursor: { x: 17, y: 40 },
    duration: 3000,
  },
  {
    title: 'Create Custom Report',
    description: 'Click "New Report" to build your own analysis.',
    highlight: { x: 80, y: 8, width: 18, height: 6 },
    cursor: { x: 88, y: 11 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Configure Columns & Filters',
    description: 'Select data columns, add filters, and choose grouping options.',
    highlight: { x: 30, y: 20, width: 65, height: 55 },
    cursor: { x: 55, y: 45 },
    action: 'click' as const,
    duration: 3500,
  },
  {
    title: 'Add Visualizations',
    description: 'Choose chart types to visualize your data.',
    highlight: { x: 30, y: 70, width: 65, height: 20 },
    cursor: { x: 55, y: 80 },
    action: 'click' as const,
    duration: 3000,
  },
];

const ARTICLES = [
  {
    title: 'Report Basics',
    description: 'Understanding report types and data sources',
    time: '4 min',
    href: '/crm/learn/reports/basics',
    icon: <BarChart3 className="w-5 h-5" />,
  },
  {
    title: 'Building Custom Reports',
    description: 'Create reports tailored to your needs',
    time: '6 min',
    href: '/crm/learn/reports/custom',
    icon: <Table className="w-5 h-5" />,
  },
  {
    title: 'Filtering & Grouping',
    description: 'Segment data for meaningful insights',
    time: '4 min',
    href: '/crm/learn/reports/filtering',
    icon: <Filter className="w-5 h-5" />,
  },
  {
    title: 'Chart Types',
    description: 'Choose the right visualization for your data',
    time: '4 min',
    href: '/crm/learn/reports/charts',
    icon: <PieChart className="w-5 h-5" />,
  },
  {
    title: 'Scheduled Reports',
    description: 'Automate report delivery via email',
    time: '3 min',
    href: '/crm/learn/reports/scheduling',
    icon: <Calendar className="w-5 h-5" />,
  },
  {
    title: 'Exporting & Sharing',
    description: 'Export to CSV/PDF and share with team',
    time: '3 min',
    href: '/crm/learn/reports/exporting',
    icon: <Share2 className="w-5 h-5" />,
  },
];

const REPORT_TYPES = [
  {
    type: 'Tabular',
    icon: <Table className="w-6 h-6" />,
    description: 'List records in rows and columns. Best for detailed data export.',
    color: 'bg-blue-500',
  },
  {
    type: 'Summary',
    icon: <BarChart3 className="w-6 h-6" />,
    description: 'Group data and show aggregates (count, sum, average). Best for overviews.',
    color: 'bg-emerald-500',
  },
  {
    type: 'Matrix',
    icon: <PieChart className="w-6 h-6" />,
    description: 'Cross-tabulate data by two dimensions. Best for comparisons.',
    color: 'bg-violet-500',
  },
];

const CHART_TYPES = [
  { name: 'Bar Chart', use: 'Compare values across categories', icon: <BarChart3 className="w-5 h-5" /> },
  { name: 'Line Chart', use: 'Show trends over time', icon: <LineChart className="w-5 h-5" /> },
  { name: 'Pie Chart', use: 'Show composition/percentages', icon: <PieChart className="w-5 h-5" /> },
  { name: 'Funnel Chart', use: 'Visualize pipeline stages', icon: <TrendingUp className="w-5 h-5" /> },
];

export default function ReportsLearnPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/crm/learn" className="text-slate-500 hover:text-teal-600 transition-colors">
          Learning Center
        </Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-900 dark:text-white font-medium">Reports & Analytics</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500">
          <BarChart3 className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Reports & Analytics
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Analyze your CRM data with powerful reports, charts, and dashboards.
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

      {/* Reports Demo */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Creating Your First Report
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Watch how to build a custom report with filters and visualizations.
        </p>
        <AnimatedDemo
          title="Report Builder"
          steps={DEMO_STEPS}
        />
      </section>

      {/* Report Types */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Report Types
        </h2>
        <div className="grid gap-4">
          {REPORT_TYPES.map((item) => (
            <div
              key={item.type}
              className="flex items-start gap-4 p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700"
            >
              <div className={`p-3 rounded-xl ${item.color} text-white`}>
                {item.icon}
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                  {item.type} Report
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Key Metrics Dashboard */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Common CRM Metrics
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-500/10 dark:to-cyan-500/10 border border-blue-200 dark:border-blue-500/30">
            <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-1">
              Deals Won
            </h3>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              Count of closed-won deals this period
            </p>
          </div>
          <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-500/10 dark:to-green-500/10 border border-emerald-200 dark:border-emerald-500/30">
            <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-1">
              Revenue
            </h3>
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              Total value of closed deals
            </p>
          </div>
          <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 border border-amber-200 dark:border-amber-500/30">
            <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">
              Win Rate
            </h3>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Won ÷ (Won + Lost) × 100
            </p>
          </div>
          <div className="p-4 rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-500/10 dark:to-purple-500/10 border border-violet-200 dark:border-violet-500/30">
            <h3 className="text-sm font-semibold text-violet-800 dark:text-violet-300 mb-1">
              Avg Deal Size
            </h3>
            <p className="text-xs text-violet-600 dark:text-violet-400">
              Total revenue ÷ deals won
            </p>
          </div>
        </div>
      </section>

      {/* Chart Types */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Chart Types
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Choose the right visualization for your data to make insights clear.
        </p>
        <div className="grid grid-cols-2 gap-4">
          {CHART_TYPES.map((chart) => (
            <div
              key={chart.name}
              className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700"
            >
              <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                {chart.icon}
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
                  {chart.name}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {chart.use}
                </p>
              </div>
            </div>
          ))}
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
              <div className="p-3 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 group-hover:bg-teal-100 dark:group-hover:bg-teal-500/20 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
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

      {/* Report Building Steps */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Building a Report
        </h2>
        <StepList
          steps={[
            {
              title: 'Select Data Source',
              description: 'Choose which module to report on (Contacts, Leads, Deals, etc.).',
            },
            {
              title: 'Choose Columns',
              description: 'Pick the fields you want to include in the report.',
            },
            {
              title: 'Apply Filters',
              description: 'Narrow down data with date ranges, statuses, owners, etc.',
            },
            {
              title: 'Configure Grouping',
              description: 'Group by owner, stage, or any field to see aggregated data.',
            },
            {
              title: 'Add Charts',
              description: 'Visualize your data with the appropriate chart type.',
            },
            {
              title: 'Save & Schedule',
              description: 'Save the report and optionally schedule email delivery.',
            },
          ]}
        />
      </section>

      {/* Export Options */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Export & Share
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-center">
            <Download className="w-8 h-8 mx-auto mb-2 text-slate-400" />
            <h3 className="font-semibold text-slate-900 dark:text-white mb-1">CSV Export</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Download raw data for spreadsheet analysis
            </p>
          </div>
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-center">
            <Download className="w-8 h-8 mx-auto mb-2 text-slate-400" />
            <h3 className="font-semibold text-slate-900 dark:text-white mb-1">PDF Export</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Generate formatted reports for presentations
            </p>
          </div>
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-center">
            <Share2 className="w-8 h-8 mx-auto mb-2 text-slate-400" />
            <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Share Link</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Share live reports with team members
            </p>
          </div>
        </div>
      </section>

      {/* Best Practices */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Reporting Best Practices
        </h2>
        <div className="space-y-4">
          <QuickTip title="Start with Questions" type="tip">
            Before building a report, define what question you're trying to answer.
            "How many deals did we close last quarter?" is better than "show me deal data."
          </QuickTip>
          <QuickTip title="Use Date Filters" type="info">
            Always filter by date to focus on relevant time periods. Compare periods
            (this month vs. last month) to identify trends.
          </QuickTip>
          <QuickTip title="Don't Over-Aggregate" type="warning">
            Too much grouping can hide important details. If a summary report shows
            unexpected results, drill down into the raw data to understand why.
          </QuickTip>
        </div>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-8">
        <Link href="/crm/learn/workflows">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Previous: Workflow Automation
          </Button>
        </Link>
        <Link href="/crm/learn">
          <Button className="gap-2">
            Back to Learning Center
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
