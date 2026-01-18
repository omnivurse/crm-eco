'use client';

import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import {
  ArrowLeft,
  ArrowRight,
  Users,
  Clock,
  Play,
  CheckCircle,
  Upload,
  Search,
  Filter,
  Merge,
  Tag,
  Trash2,
  Edit,
  Plus,
} from 'lucide-react';
import { AnimatedDemo, StepList, QuickTip } from '@/components/learn/AnimatedDemo';

const ARTICLES = [
  {
    title: 'Creating Contacts',
    description: 'Learn how to add new contacts to your CRM',
    time: '3 min',
    href: '/crm/learn/contacts/creating',
    icon: <Plus className="w-5 h-5" />,
    steps: [
      'Click the + button or use ⌘+N',
      'Fill in contact details',
      'Assign to an account (optional)',
      'Save your contact',
    ],
  },
  {
    title: 'Importing Contacts',
    description: 'Bulk import contacts from CSV or other sources',
    time: '4 min',
    href: '/crm/learn/contacts/importing',
    icon: <Upload className="w-5 h-5" />,
    steps: [
      'Prepare your CSV file',
      'Go to Contacts → Import',
      'Map your columns',
      'Review and import',
    ],
  },
  {
    title: 'Searching & Filtering',
    description: 'Find contacts quickly with search and filters',
    time: '3 min',
    href: '/crm/learn/contacts/searching',
    icon: <Search className="w-5 h-5" />,
    steps: [
      'Use the search bar for quick lookups',
      'Apply filters for specific criteria',
      'Save views for frequent searches',
      'Use advanced filter builder',
    ],
  },
  {
    title: 'Custom Fields',
    description: 'Add custom fields to capture unique data',
    time: '5 min',
    href: '/crm/learn/contacts/fields',
    icon: <Edit className="w-5 h-5" />,
    steps: [
      'Go to Settings → Modules',
      'Select Contacts module',
      'Add custom fields',
      'Set field types and options',
    ],
  },
  {
    title: 'Merging Duplicates',
    description: 'Combine duplicate contact records',
    time: '3 min',
    href: '/crm/learn/contacts/merging',
    icon: <Merge className="w-5 h-5" />,
    steps: [
      'Find duplicate contacts',
      'Select records to merge',
      'Choose master record',
      'Review and confirm merge',
    ],
  },
  {
    title: 'Tags & Organization',
    description: 'Use tags to categorize and organize contacts',
    time: '3 min',
    href: '/crm/learn/contacts/tags',
    icon: <Tag className="w-5 h-5" />,
    steps: [
      'Open a contact record',
      'Click Add Tag',
      'Create or select tags',
      'Filter by tags in list view',
    ],
  },
];

const DEMO_STEPS = [
  {
    title: 'Open Contacts Module',
    description: 'Click on "Contacts" in the navigation to view your contact list.',
    cursor: { x: 25, y: 7 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Browse Your Contacts',
    description: 'You\'ll see all your contacts in a list or grid view. Click any contact to view details.',
    highlight: { x: 22, y: 15, width: 76, height: 75 },
    cursor: { x: 50, y: 45 },
    duration: 3500,
  },
  {
    title: 'Use Quick Search',
    description: 'Start typing in the search bar to quickly find contacts by name, email, or phone.',
    highlight: { x: 22, y: 16, width: 30, height: 7 },
    cursor: { x: 35, y: 19 },
    action: 'type' as const,
    duration: 3000,
  },
  {
    title: 'Apply Filters',
    description: 'Use filters to narrow down contacts by specific criteria like company, status, or custom fields.',
    highlight: { x: 55, y: 16, width: 12, height: 7 },
    cursor: { x: 60, y: 19 },
    action: 'click' as const,
    duration: 3000,
  },
  {
    title: 'Create New Contact',
    description: 'Click the + button to add a new contact to your CRM.',
    highlight: { x: 85, y: 16, width: 12, height: 7 },
    cursor: { x: 90, y: 19 },
    action: 'click' as const,
    duration: 2500,
  },
];

export default function ContactsLearnPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/crm/learn" className="text-slate-500 hover:text-teal-600 transition-colors">
          Learning Center
        </Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-900 dark:text-white font-medium">Contacts</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500">
          <Users className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Managing Contacts
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Learn how to effectively organize, manage, and grow your contact database.
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

      {/* Overview Demo */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Contacts Overview
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Watch this interactive demo to see how the Contacts module works.
        </p>
        <AnimatedDemo
          title="Contacts Module Tour"
          steps={DEMO_STEPS}
        />
      </section>

      {/* Key Concepts */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Key Concepts
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
              Contacts vs. Leads
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              <strong>Contacts</strong> are individuals you have an established relationship with.
              <strong> Leads</strong> are potential customers who haven't been qualified yet.
              Convert leads to contacts when they become customers.
            </p>
          </div>
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
              Contacts & Accounts
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Contacts can be linked to <strong>Accounts</strong> (companies/organizations).
              This helps you see all contacts at a company and track account-level activities.
            </p>
          </div>
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
              className="group p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 hover:border-teal-500/50 hover:shadow-md transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 group-hover:bg-teal-100 dark:group-hover:bg-teal-500/20 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                  {article.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                      {article.title}
                    </h3>
                    <span className="flex items-center gap-1 text-sm text-slate-500">
                      <Clock className="w-3 h-3" />
                      {article.time}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                    {article.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {article.steps.map((step, index) => (
                      <span
                        key={index}
                        className="flex items-center gap-1 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-1 rounded-full"
                      >
                        <CheckCircle className="w-3 h-3 text-emerald-500" />
                        {step}
                      </span>
                    ))}
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-teal-500 transition-colors flex-shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Best Practices */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Best Practices
        </h2>
        <div className="space-y-4">
          <QuickTip title="Keep Data Clean" type="tip">
            Regularly review and merge duplicate contacts. Use consistent formatting for
            phone numbers and addresses. Set up validation rules for required fields.
          </QuickTip>
          <QuickTip title="Use Tags Strategically" type="info">
            Create a tagging system that makes sense for your business. Use tags like
            "VIP", "Newsletter Subscriber", or "Event Attendee" to segment contacts for
            targeted campaigns.
          </QuickTip>
          <QuickTip title="Before Deleting" type="warning">
            Deleting a contact removes all associated activities and history. Consider
            archiving or tagging as "Inactive" instead to preserve historical data.
          </QuickTip>
        </div>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-8">
        <Link href="/crm/learn">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Learning Center
          </Button>
        </Link>
        <Link href="/crm/learn/leads">
          <Button className="gap-2">
            Next: Lead Management
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
