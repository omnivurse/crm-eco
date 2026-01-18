'use client';

import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import {
  ArrowLeft,
  ArrowRight,
  Columns,
  Clock,
  CheckCircle,
  Type,
  Hash,
  Calendar,
  ListOrdered,
  ToggleLeft,
  Link2,
  Plus,
  Settings,
} from 'lucide-react';
import { AnimatedDemo, StepList, QuickTip } from '@/components/learn/AnimatedDemo';

const DEMO_STEPS = [
  {
    title: 'Go to Settings',
    description: 'Click your profile icon and select "Settings".',
    cursor: { x: 92, y: 5 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Navigate to Modules',
    description: 'Click on "Modules" in the settings sidebar.',
    cursor: { x: 15, y: 30 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Select Contacts',
    description: 'Choose "Contacts" from the modules list.',
    cursor: { x: 15, y: 42 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Click Custom Fields',
    description: 'Go to the "Custom Fields" tab to manage contact fields.',
    highlight: { x: 20, y: 20, width: 25, height: 5 },
    cursor: { x: 32, y: 22 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Add New Field',
    description: 'Click "Add Field" to create a custom field.',
    highlight: { x: 70, y: 25, width: 15, height: 5 },
    cursor: { x: 77, y: 27 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Configure Field',
    description: 'Set the field name, type, and options.',
    highlight: { x: 25, y: 35, width: 50, height: 40 },
    cursor: { x: 50, y: 55 },
    duration: 3000,
  },
];

const FIELD_TYPES = [
  { icon: <Type className="w-5 h-5" />, name: 'Text', description: 'Single line of text', example: 'Job Title, Website' },
  { icon: <Type className="w-5 h-5" />, name: 'Long Text', description: 'Multiple lines of text', example: 'Notes, Description' },
  { icon: <Hash className="w-5 h-5" />, name: 'Number', description: 'Numeric values', example: 'Employee Count, Revenue' },
  { icon: <Calendar className="w-5 h-5" />, name: 'Date', description: 'Date selector', example: 'Birthday, Contract Start' },
  { icon: <ListOrdered className="w-5 h-5" />, name: 'Dropdown', description: 'Single selection list', example: 'Industry, Status' },
  { icon: <ToggleLeft className="w-5 h-5" />, name: 'Checkbox', description: 'Yes/No toggle', example: 'Is Active, Opted In' },
  { icon: <Link2 className="w-5 h-5" />, name: 'URL', description: 'Web link', example: 'LinkedIn, Portfolio' },
];

export default function FieldsPage() {
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
        <span className="text-slate-900 dark:text-white font-medium">Custom Fields</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500">
          <Columns className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Contact Fields & Custom Fields
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Extend your contact records with custom fields to capture the data you need.
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
          title="Creating Custom Fields"
          steps={DEMO_STEPS}
        />
      </section>

      {/* Default Fields */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Default Contact Fields
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Every contact comes with these standard fields:
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {['First Name', 'Last Name', 'Email', 'Phone', 'Company', 'Title', 'Address', 'City', 'State', 'Country', 'Notes', 'Owner'].map((field) => (
            <div
              key={field}
              className="flex items-center gap-2 p-3 rounded-lg bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700"
            >
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span className="text-sm text-slate-700 dark:text-slate-300">{field}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Custom Field Types */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Custom Field Types
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Create custom fields to track any data specific to your business:
        </p>
        <div className="grid gap-3">
          {FIELD_TYPES.map((type) => (
            <div
              key={type.name}
              className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700"
            >
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                {type.icon}
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-slate-900 dark:text-white">{type.name}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">{type.description}</p>
              </div>
              <div className="text-sm text-slate-400">
                e.g., {type.example}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Step by Step */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Creating a Custom Field
        </h2>
        <StepList
          steps={[
            {
              title: 'Access Field Settings',
              description: 'Go to Settings → Modules → Contacts → Custom Fields.',
            },
            {
              title: 'Click Add Field',
              description: 'Click the "Add Field" button to create a new custom field.',
            },
            {
              title: 'Choose Field Type',
              description: 'Select the appropriate field type for your data.',
            },
            {
              title: 'Name Your Field',
              description: 'Enter a clear, descriptive name. This appears as the field label.',
            },
            {
              title: 'Configure Options',
              description: 'For dropdowns, add the list of options. Set required/optional status.',
            },
            {
              title: 'Save and Use',
              description: 'Save the field. It immediately appears on all contact forms.',
            },
          ]}
        />
      </section>

      {/* Tips */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Best Practices
        </h2>
        <div className="space-y-4">
          <QuickTip title="Plan Before Creating" type="tip">
            Map out all the fields you need before creating them. It's easier to set up
            correctly the first time than to reorganize later.
          </QuickTip>
          <QuickTip title="Use Consistent Naming" type="info">
            Use clear, consistent naming conventions. "Lead Source" is better than "src"
            or "Where From".
          </QuickTip>
          <QuickTip title="Required Fields" type="warning">
            Only mark fields as required if they're truly essential. Too many required
            fields slow down data entry and frustrate users.
          </QuickTip>
        </div>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-8">
        <Link href="/crm/learn/contacts/importing">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Previous: Importing Contacts
          </Button>
        </Link>
        <Link href="/crm/learn/contacts/merging">
          <Button className="gap-2">
            Next: Merging Duplicates
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
