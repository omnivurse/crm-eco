'use client';

import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import {
  ArrowLeft,
  ArrowRight,
  FileBarChart,
  Clock,
  CheckCircle,
  Table,
  PieChart,
  BarChart3,
  Filter,
  Group,
  Plus,
} from 'lucide-react';
import { AnimatedDemo, StepList, QuickTip } from '@/components/learn/AnimatedDemo';

const DEMO_STEPS = [
  {
    title: 'Go to Reports',
    description: 'Navigate to Reports from the main menu.',
    cursor: { x: 8, y: 50 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Click Create Report',
    description: 'Click "Create Report" to start building.',
    highlight: { x: 75, y: 12, width: 18, height: 5 },
    cursor: { x: 84, y: 14 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Select Module',
    description: 'Choose which module to report on (Contacts, Deals, etc.).',
    highlight: { x: 25, y: 25, width: 50, height: 20 },
    cursor: { x: 50, y: 35 },
    action: 'click' as const,
    duration: 3000,
  },
  {
    title: 'Choose Columns',
    description: 'Select the fields you want to include in your report.',
    highlight: { x: 15, y: 50, width: 70, height: 25 },
    cursor: { x: 50, y: 62 },
    action: 'click' as const,
    duration: 3500,
  },
  {
    title: 'Add Filters',
    description: 'Filter the data to show only what you need.',
    highlight: { x: 15, y: 78, width: 70, height: 10 },
    cursor: { x: 50, y: 83 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Save Report',
    description: 'Name your report and save it for future use.',
    highlight: { x: 75, y: 85, width: 15, height: 5 },
    cursor: { x: 82, y: 87 },
    action: 'click' as const,
    duration: 2500,
  },
];

const REPORT_TYPES = [
  { icon: <Table className="w-5 h-5" />, name: 'Tabular', description: 'List of records in rows and columns' },
  { icon: <Group className="w-5 h-5" />, name: 'Summary', description: 'Grouped data with subtotals' },
  { icon: <BarChart3 className="w-5 h-5" />, name: 'Chart', description: 'Visual bar, line, or area chart' },
  { icon: <PieChart className="w-5 h-5" />, name: 'Pie/Donut', description: 'Distribution breakdown' },
];

export default function CustomReportsPage() {
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
        <span className="text-slate-900 dark:text-white font-medium">Building Custom Reports</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500">
          <FileBarChart className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Building Custom Reports
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Create tailored reports to answer your specific business questions.
          </p>
          <div className="flex items-center gap-4 mt-4 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              6 min read
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
          title="Creating a Custom Report"
          steps={DEMO_STEPS}
        />
      </section>

      {/* Report Types */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Report Types
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {REPORT_TYPES.map((type) => (
            <div
              key={type.name}
              className="flex items-start gap-3 p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700"
            >
              <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400">
                {type.icon}
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">{type.name}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">{type.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Building a Report */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Building Your Report
        </h2>
        <StepList
          steps={[
            {
              title: 'Choose the Module',
              description: 'Select which data to report on: Contacts, Deals, Leads, etc.',
            },
            {
              title: 'Select Columns',
              description: 'Pick the fields you want to see. Drag to reorder.',
            },
            {
              title: 'Add Filters',
              description: 'Narrow down records (e.g., "Status = Won", "Created this month").',
            },
            {
              title: 'Configure Grouping',
              description: 'For summary reports, group by a field (e.g., by Owner, by Stage).',
            },
            {
              title: 'Add Aggregations',
              description: 'Calculate totals: Count, Sum, Average, Min, Max.',
            },
            {
              title: 'Choose Visualization',
              description: 'Optionally add a chart to visualize the data.',
            },
            {
              title: 'Save and Share',
              description: 'Name your report. Share with team or keep private.',
            },
          ]}
        />
      </section>

      {/* Example Reports */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Example Reports
        </h2>
        <div className="grid gap-4">
          {[
            {
              name: 'Deals by Stage',
              type: 'Summary',
              fields: 'Stage, Count, Total Value',
              filter: 'Open deals only',
            },
            {
              name: 'Lead Sources This Month',
              type: 'Pie Chart',
              fields: 'Lead Source, Count',
              filter: 'Created this month',
            },
            {
              name: 'Sales by Rep',
              type: 'Bar Chart',
              fields: 'Owner, Sum of Deal Value',
              filter: 'Closed Won, this quarter',
            },
            {
              name: 'Overdue Tasks',
              type: 'Tabular',
              fields: 'Task, Due Date, Assignee, Related Contact',
              filter: 'Due date < Today, Status = Open',
            },
          ].map((report) => (
            <div
              key={report.name}
              className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"
            >
              <h3 className="font-semibold text-slate-900 dark:text-white mb-2">{report.name}</h3>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <span className="text-slate-500">Type:</span>
                  <span className="ml-1 text-slate-700 dark:text-slate-300">{report.type}</span>
                </div>
                <div>
                  <span className="text-slate-500">Fields:</span>
                  <span className="ml-1 text-slate-700 dark:text-slate-300">{report.fields}</span>
                </div>
                <div>
                  <span className="text-slate-500">Filter:</span>
                  <span className="ml-1 text-slate-700 dark:text-slate-300">{report.filter}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Tips */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Report Building Tips
        </h2>
        <div className="space-y-4">
          <QuickTip title="Start with the Question" type="tip">
            Before building, ask: "What question am I trying to answer?"
            This focuses your report on what matters.
          </QuickTip>
          <QuickTip title="Less is More" type="info">
            Don't add every field. Focus on the data that drives decisions.
            Too many columns make reports hard to read.
          </QuickTip>
          <QuickTip title="Clone and Modify" type="info">
            Find a similar existing report? Clone it and adjust rather than
            starting from scratch.
          </QuickTip>
        </div>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-8">
        <Link href="/crm/learn/reports/dashboard">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Previous: Dashboard Overview
          </Button>
        </Link>
        <Link href="/crm/learn/reports/scheduling">
          <Button className="gap-2">
            Next: Scheduling Reports
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
