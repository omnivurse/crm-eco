'use client';

import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import {
  ArrowLeft,
  ArrowRight,
  Upload,
  Clock,
  CheckCircle,
  FileSpreadsheet,
  AlertTriangle,
  Download,
  Eye,
} from 'lucide-react';
import { AnimatedDemo, StepList, QuickTip } from '@/components/learn/AnimatedDemo';

const DEMO_STEPS = [
  {
    title: 'Go to Contacts',
    description: 'Navigate to the Contacts module from the main navigation.',
    cursor: { x: 25, y: 7 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Click "Import"',
    description: 'Find and click the "Import" button in the toolbar.',
    highlight: { x: 75, y: 15, width: 15, height: 6 },
    cursor: { x: 82, y: 18 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Upload CSV File',
    description: 'Drag and drop your CSV file, or click to browse and select it.',
    highlight: { x: 25, y: 25, width: 50, height: 25 },
    cursor: { x: 50, y: 37 },
    action: 'click' as const,
    duration: 3000,
  },
  {
    title: 'Map Columns',
    description: 'Match your CSV columns to CRM fields. We auto-detect common names.',
    highlight: { x: 15, y: 52, width: 70, height: 30 },
    cursor: { x: 50, y: 67 },
    action: 'click' as const,
    duration: 3500,
  },
  {
    title: 'Review Preview',
    description: 'Check the preview to ensure data looks correct before importing.',
    highlight: { x: 15, y: 60, width: 70, height: 20 },
    cursor: { x: 50, y: 70 },
    duration: 3000,
  },
  {
    title: 'Start Import',
    description: 'Click "Import" to begin. You\'ll see progress and results when complete.',
    highlight: { x: 70, y: 82, width: 20, height: 8 },
    cursor: { x: 80, y: 86 },
    action: 'click' as const,
    duration: 2500,
  },
];

const REQUIRED_COLUMNS = [
  { column: 'email', description: 'Email address (used for duplicate detection)', example: 'john@acme.com' },
];

const RECOMMENDED_COLUMNS = [
  { column: 'first_name', description: 'First/given name', example: 'John' },
  { column: 'last_name', description: 'Last/family name', example: 'Smith' },
  { column: 'phone', description: 'Primary phone number', example: '+1 555-123-4567' },
  { column: 'company', description: 'Company/organization name', example: 'Acme Corp' },
  { column: 'title', description: 'Job title', example: 'Sales Manager' },
];

export default function ImportingContactsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/crm/learn" className="text-slate-500 hover:text-teal-600 transition-colors">
          Learning Center
        </Link>
        <span className="text-slate-400">/</span>
        <Link href="/crm/learn/contacts" className="text-slate-500 hover:text-teal-600 transition-colors">
          Contacts
        </Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-900 dark:text-white font-medium">Importing Contacts</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500">
          <Upload className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Importing Contacts
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Bulk import contacts from a CSV file to quickly populate your CRM.
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
          title="Importing Contacts"
          steps={DEMO_STEPS}
        />
      </section>

      {/* File Requirements */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          File Requirements
        </h2>
        <div className="grid gap-4">
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
              <h3 className="font-semibold text-slate-900 dark:text-white">Supported Format</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              CSV (Comma-Separated Values) files only. Export from Excel using "Save As → CSV".
              UTF-8 encoding recommended for special characters.
            </p>
          </div>
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              <h3 className="font-semibold text-slate-900 dark:text-white">File Limits</h3>
            </div>
            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
              <li>• Maximum 10,000 rows per import</li>
              <li>• Maximum 50MB file size</li>
              <li>• First row must contain column headers</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Column Reference */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Column Reference
        </h2>

        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400">
              Required
            </span>
          </h3>
          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            {REQUIRED_COLUMNS.map((col) => (
              <div key={col.column} className="grid grid-cols-12 gap-4 p-4 items-center">
                <div className="col-span-3">
                  <code className="text-sm text-teal-600 dark:text-teal-400">{col.column}</code>
                </div>
                <div className="col-span-5 text-sm text-slate-600 dark:text-slate-400">
                  {col.description}
                </div>
                <div className="col-span-4 text-sm text-slate-500">
                  e.g., {col.example}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
              Recommended
            </span>
          </h3>
          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            {RECOMMENDED_COLUMNS.map((col, index) => (
              <div
                key={col.column}
                className={`grid grid-cols-12 gap-4 p-4 items-center ${
                  index < RECOMMENDED_COLUMNS.length - 1 ? 'border-b border-slate-200 dark:border-slate-700' : ''
                }`}
              >
                <div className="col-span-3">
                  <code className="text-sm text-teal-600 dark:text-teal-400">{col.column}</code>
                </div>
                <div className="col-span-5 text-sm text-slate-600 dark:text-slate-400">
                  {col.description}
                </div>
                <div className="col-span-4 text-sm text-slate-500">
                  e.g., {col.example}
                </div>
              </div>
            ))}
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
              title: 'Prepare Your CSV',
              description: 'Export data from your source (Excel, Google Sheets, another CRM) as a CSV file. Ensure the first row has column headers.',
            },
            {
              title: 'Go to Contacts → Import',
              description: 'Navigate to the Contacts module and click the "Import" button in the toolbar.',
            },
            {
              title: 'Upload Your File',
              description: 'Drag and drop your CSV file into the upload area, or click to browse and select it.',
            },
            {
              title: 'Map Columns',
              description: 'The system auto-detects common column names. Review and adjust the mapping if needed. Unmapped columns will be skipped.',
            },
            {
              title: 'Configure Options',
              description: 'Choose how to handle duplicates: skip, update existing, or create anyway. Select a default owner if needed.',
            },
            {
              title: 'Preview Data',
              description: 'Review the first few rows to ensure everything looks correct. Check for encoding issues or misaligned data.',
            },
            {
              title: 'Start Import',
              description: 'Click "Import" to begin. Large imports run in the background - you\'ll be notified when complete.',
            },
            {
              title: 'Review Results',
              description: 'After import, review the summary: how many created, updated, skipped, or failed. Download the error log if needed.',
            },
          ]}
        />
      </section>

      {/* Handling Duplicates */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Handling Duplicates
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Duplicates are detected by email address. Choose how to handle them:
        </p>
        <div className="grid gap-4">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Skip Duplicates</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              If an email already exists, skip that row entirely. Safest option.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Update Existing</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              If an email already exists, update the contact with new data. Good for refreshing data.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Create Anyway</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Create all contacts even if duplicates exist. You'll need to merge later.
            </p>
          </div>
        </div>
      </section>

      {/* Tips */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Tips & Best Practices
        </h2>
        <div className="space-y-4">
          <QuickTip title="Clean Your Data First" type="tip">
            Remove blank rows, fix obvious typos, and standardize formatting (phone numbers,
            countries) in your spreadsheet before importing.
          </QuickTip>
          <QuickTip title="Test with a Small Batch" type="info">
            Before importing thousands of contacts, test with 10-20 rows first. Check that
            data mapped correctly, then delete the test contacts and import the full file.
          </QuickTip>
          <QuickTip title="Keep a Backup" type="warning">
            Always keep the original CSV file. If something goes wrong or data looks wrong,
            you can reference the source or re-import.
          </QuickTip>
        </div>
      </section>

      {/* Download Template */}
      <section className="p-6 rounded-xl bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-500/10 dark:to-emerald-500/10 border border-teal-200 dark:border-teal-500/30">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-teal-800 dark:text-teal-300 mb-1">
              Download Sample Template
            </h3>
            <p className="text-sm text-teal-700 dark:text-teal-400">
              Start with our pre-formatted CSV template with all recommended columns.
            </p>
          </div>
          <Button className="bg-teal-600 hover:bg-teal-700 gap-2">
            <Download className="w-4 h-4" />
            Download Template
          </Button>
        </div>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-8">
        <Link href="/crm/learn/contacts/creating">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Previous: Creating Contacts
          </Button>
        </Link>
        <Link href="/crm/learn/contacts/fields">
          <Button className="gap-2">
            Next: Custom Fields
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
