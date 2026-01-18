'use client';

import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Clock,
  CheckCircle,
  FileSpreadsheet,
  FileText,
  Database,
  Table,
  Filter,
} from 'lucide-react';
import { AnimatedDemo, StepList, QuickTip } from '@/components/learn/AnimatedDemo';

const DEMO_STEPS = [
  {
    title: 'Open Data View',
    description: 'Go to the module (Contacts, Deals, etc.) you want to export.',
    cursor: { x: 8, y: 25 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Apply Filters',
    description: 'Filter the data to export only what you need.',
    highlight: { x: 15, y: 12, width: 40, height: 5 },
    cursor: { x: 35, y: 14 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Click Export',
    description: 'Click the "Export" button in the toolbar.',
    highlight: { x: 80, y: 12, width: 12, height: 5 },
    cursor: { x: 86, y: 14 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Choose Format',
    description: 'Select CSV for spreadsheets or PDF for formatted reports.',
    highlight: { x: 30, y: 35, width: 40, height: 20 },
    cursor: { x: 50, y: 45 },
    action: 'click' as const,
    duration: 3000,
  },
  {
    title: 'Select Fields',
    description: 'Choose which fields to include in the export.',
    highlight: { x: 30, y: 58, width: 40, height: 20 },
    cursor: { x: 50, y: 68 },
    duration: 3000,
  },
  {
    title: 'Download',
    description: 'Click "Export" to download your file.',
    highlight: { x: 55, y: 80, width: 15, height: 5 },
    cursor: { x: 62, y: 82 },
    action: 'click' as const,
    duration: 2500,
  },
];

const EXPORT_FORMATS = [
  {
    icon: <FileSpreadsheet className="w-5 h-5" />,
    name: 'CSV',
    description: 'Comma-separated values',
    best: 'Excel, Google Sheets, data analysis',
  },
  {
    icon: <FileText className="w-5 h-5" />,
    name: 'PDF',
    description: 'Formatted document',
    best: 'Sharing, printing, presentations',
  },
];

export default function ExportingPage() {
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
        <span className="text-slate-900 dark:text-white font-medium">Exporting Data</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500">
          <Download className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Exporting Data
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Download your CRM data for analysis, backup, or sharing.
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
          title="Exporting Data"
          steps={DEMO_STEPS}
        />
      </section>

      {/* Export Formats */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Export Formats
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {EXPORT_FORMATS.map((format) => (
            <div
              key={format.name}
              className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400">
                  {format.icon}
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white">{format.name}</h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">{format.description}</p>
              <p className="text-xs text-slate-500">Best for: {format.best}</p>
            </div>
          ))}
        </div>
      </section>

      {/* What Can Be Exported */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          What Can Be Exported
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { icon: <Table className="w-5 h-5" />, name: 'Module Data', description: 'Contacts, Leads, Deals, etc.' },
            { icon: <FileText className="w-5 h-5" />, name: 'Reports', description: 'Any saved report' },
            { icon: <Filter className="w-5 h-5" />, name: 'Filtered Views', description: 'Current filtered results' },
            { icon: <Database className="w-5 h-5" />, name: 'Full Backup', description: 'All data (Admin only)' },
          ].map((item) => (
            <div
              key={item.name}
              className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700"
            >
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {item.icon}
              </div>
              <div>
                <h3 className="font-medium text-slate-900 dark:text-white">{item.name}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Step by Step */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          How to Export
        </h2>
        <StepList
          steps={[
            {
              title: 'Navigate to the Data',
              description: 'Go to the module, report, or view you want to export.',
            },
            {
              title: 'Apply Filters (Optional)',
              description: 'Filter the data if you only want a subset.',
            },
            {
              title: 'Click Export',
              description: 'Click the "Export" button in the toolbar.',
            },
            {
              title: 'Choose Format',
              description: 'Select CSV for data or PDF for formatted output.',
            },
            {
              title: 'Select Fields',
              description: 'Check the fields you want to include. All are selected by default.',
            },
            {
              title: 'Download',
              description: 'Click "Export" to generate and download the file.',
            },
          ]}
        />
      </section>

      {/* Tips */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Export Tips
        </h2>
        <div className="space-y-4">
          <QuickTip title="Filter First" type="tip">
            Export only what you need. Exporting 100,000 contacts when you only
            need 500 creates unnecessarily large files.
          </QuickTip>
          <QuickTip title="CSV for Analysis" type="info">
            If you're doing data analysis in Excel or another tool, always choose CSV.
            It preserves data in a format that's easy to manipulate.
          </QuickTip>
          <QuickTip title="Check Encoding" type="warning">
            If special characters (accents, symbols) look wrong in Excel, try opening
            the CSV with UTF-8 encoding selected.
          </QuickTip>
        </div>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-8">
        <Link href="/crm/learn/reports/scheduling">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Previous: Scheduling Reports
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
