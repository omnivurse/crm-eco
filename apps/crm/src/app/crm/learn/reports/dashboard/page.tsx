'use client';

import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import {
  ArrowLeft,
  ArrowRight,
  LayoutDashboard,
  Clock,
  CheckCircle,
  BarChart3,
  TrendingUp,
  Users,
  DollarSign,
  Target,
  Settings,
} from 'lucide-react';
import { AnimatedDemo, StepList, QuickTip } from '@/components/learn/AnimatedDemo';

const DEMO_STEPS = [
  {
    title: 'Navigate to Reports',
    description: 'Click "Reports" in the main navigation.',
    cursor: { x: 8, y: 50 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'View Dashboard',
    description: 'The dashboard shows key metrics and charts.',
    highlight: { x: 15, y: 15, width: 70, height: 70 },
    cursor: { x: 50, y: 50 },
    duration: 3500,
  },
  {
    title: 'Check KPI Cards',
    description: 'Quick stats are displayed at the top.',
    highlight: { x: 15, y: 15, width: 70, height: 15 },
    cursor: { x: 50, y: 22 },
    duration: 2500,
  },
  {
    title: 'View Charts',
    description: 'Interactive charts show trends over time.',
    highlight: { x: 15, y: 35, width: 70, height: 30 },
    cursor: { x: 50, y: 50 },
    duration: 3000,
  },
  {
    title: 'Change Date Range',
    description: 'Use the date picker to adjust the reporting period.',
    highlight: { x: 70, y: 10, width: 18, height: 5 },
    cursor: { x: 79, y: 12 },
    action: 'click' as const,
    duration: 2500,
  },
];

const WIDGETS = [
  { icon: <DollarSign className="w-5 h-5" />, name: 'Revenue Overview', description: 'Total revenue by period' },
  { icon: <Target className="w-5 h-5" />, name: 'Pipeline Value', description: 'Open deals by stage' },
  { icon: <TrendingUp className="w-5 h-5" />, name: 'Deal Velocity', description: 'Average time to close' },
  { icon: <Users className="w-5 h-5" />, name: 'Lead Sources', description: 'Where leads come from' },
  { icon: <BarChart3 className="w-5 h-5" />, name: 'Activity Summary', description: 'Calls, emails, meetings' },
  { icon: <CheckCircle className="w-5 h-5" />, name: 'Win/Loss Ratio', description: 'Deal success rate' },
];

export default function ReportsDashboardPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/crm/learn" className="text-slate-500 hover:text-teal-600 transition-colors">
          Learning Center
        </Link>
        <span className="text-slate-400">/</span>
        <Link href="/crm/learn/reports" className="text-slate-500 hover:text-teal-600 transition-colors">
          Reports
        </Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-900 dark:text-white font-medium">Dashboard Overview</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500">
          <LayoutDashboard className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Reports Dashboard Overview
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Get a high-level view of your business performance at a glance.
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
          title="Using the Reports Dashboard"
          steps={DEMO_STEPS}
        />
      </section>

      {/* Dashboard Widgets */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Dashboard Widgets
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          The reports dashboard includes several pre-built widgets showing your key metrics:
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          {WIDGETS.map((widget) => (
            <div
              key={widget.name}
              className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700"
            >
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                {widget.icon}
              </div>
              <div>
                <h3 className="font-medium text-slate-900 dark:text-white">{widget.name}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{widget.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Using the Dashboard */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Using the Dashboard
        </h2>
        <StepList
          steps={[
            {
              title: 'Navigate to Reports',
              description: 'Click "Reports" in the sidebar to access the dashboard.',
            },
            {
              title: 'Review KPI Cards',
              description: 'Quick stats at the top show your most important numbers.',
            },
            {
              title: 'Explore Charts',
              description: 'Hover over charts for details. Click legends to filter.',
            },
            {
              title: 'Change Date Range',
              description: 'Use the date picker to view different time periods.',
            },
            {
              title: 'Drill Down',
              description: 'Click on chart elements to see the underlying data.',
            },
            {
              title: 'Customize (Admin)',
              description: 'Admins can add, remove, or rearrange dashboard widgets.',
            },
          ]}
        />
      </section>

      {/* Tips */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Dashboard Tips
        </h2>
        <div className="space-y-4">
          <QuickTip title="Check Daily" type="tip">
            Make the dashboard your first stop each morning. It shows what needs
            attention and where you stand against goals.
          </QuickTip>
          <QuickTip title="Compare Periods" type="info">
            Most widgets show comparison to the previous period. A green arrow
            means improvement, red means decline.
          </QuickTip>
          <QuickTip title="Export for Meetings" type="info">
            Click the export button to download the dashboard as a PDF for
            stakeholder meetings and presentations.
          </QuickTip>
        </div>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-8">
        <Link href="/crm/learn/reports">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Reports
          </Button>
        </Link>
        <Link href="/crm/learn/reports/custom">
          <Button className="gap-2">
            Next: Custom Reports
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
