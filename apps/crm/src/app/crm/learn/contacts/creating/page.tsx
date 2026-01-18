'use client';

import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import {
  ArrowLeft,
  ArrowRight,
  Users,
  Clock,
  CheckCircle,
  Plus,
  User,
  Mail,
  Phone,
  Building,
  MapPin,
  Tag,
  Save,
} from 'lucide-react';
import { AnimatedDemo, StepList, QuickTip } from '@/components/learn/AnimatedDemo';

const DEMO_STEPS = [
  {
    title: 'Click the + Button',
    description: 'Find the "+" button in the top navigation bar and click it.',
    cursor: { x: 90, y: 6 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Select "Contact"',
    description: 'From the dropdown menu, click "Contact" to open the create form.',
    highlight: { x: 75, y: 10, width: 20, height: 20 },
    cursor: { x: 85, y: 15 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Enter Basic Info',
    description: 'Fill in the contact\'s first name, last name, and email address.',
    highlight: { x: 25, y: 20, width: 50, height: 25 },
    cursor: { x: 50, y: 32 },
    action: 'type' as const,
    duration: 3500,
  },
  {
    title: 'Add Phone Number',
    description: 'Enter the contact\'s phone number. You can add multiple phone numbers.',
    highlight: { x: 25, y: 45, width: 50, height: 10 },
    cursor: { x: 50, y: 50 },
    action: 'type' as const,
    duration: 2500,
  },
  {
    title: 'Link to Account (Optional)',
    description: 'Search for and select an account/company to associate with this contact.',
    highlight: { x: 25, y: 55, width: 50, height: 10 },
    cursor: { x: 50, y: 60 },
    action: 'click' as const,
    duration: 3000,
  },
  {
    title: 'Save the Contact',
    description: 'Click "Save" to create the contact. It will appear in your contacts list.',
    highlight: { x: 55, y: 80, width: 20, height: 8 },
    cursor: { x: 65, y: 84 },
    action: 'click' as const,
    duration: 2500,
  },
];

const REQUIRED_FIELDS = [
  { field: 'First Name', description: 'The contact\'s first/given name', required: true },
  { field: 'Last Name', description: 'The contact\'s last/family name', required: true },
  { field: 'Email', description: 'Primary email address', required: true },
];

const OPTIONAL_FIELDS = [
  { field: 'Phone', icon: <Phone className="w-4 h-4" />, description: 'Primary phone number' },
  { field: 'Mobile', icon: <Phone className="w-4 h-4" />, description: 'Mobile/cell phone number' },
  { field: 'Account', icon: <Building className="w-4 h-4" />, description: 'Associated company' },
  { field: 'Job Title', icon: <User className="w-4 h-4" />, description: 'Professional title' },
  { field: 'Address', icon: <MapPin className="w-4 h-4" />, description: 'Physical/mailing address' },
  { field: 'Tags', icon: <Tag className="w-4 h-4" />, description: 'Labels for organization' },
];

export default function CreatingContactsPage() {
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
        <span className="text-slate-900 dark:text-white font-medium">Creating Contacts</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500">
          <Plus className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Creating Contacts
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Learn how to add new contacts to your CRM, one at a time.
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
          Video Walkthrough
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Watch this quick demo to see how to create a contact step by step.
        </p>
        <AnimatedDemo
          title="Creating a Contact"
          steps={DEMO_STEPS}
        />
      </section>

      {/* Prerequisites */}
      <section className="p-6 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30">
        <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-3">
          Before You Start
        </h3>
        <ul className="space-y-2 text-sm text-blue-700 dark:text-blue-400">
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Make sure you have the contact's email address (required)
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Know which account/company they belong to (optional but recommended)
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Have any relevant tags ready for categorization
          </li>
        </ul>
      </section>

      {/* Step by Step */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Step-by-Step Instructions
        </h2>
        <StepList
          steps={[
            {
              title: 'Open the Create Menu',
              description: 'Click the "+" button in the top navigation bar. This opens a dropdown menu with options to create different record types.',
            },
            {
              title: 'Select "Contact"',
              description: 'Click "Contact" from the dropdown. A slide-out panel or modal will appear with the contact creation form.',
            },
            {
              title: 'Enter Required Information',
              description: 'Fill in the contact\'s first name, last name, and email address. These fields are required and cannot be left blank.',
            },
            {
              title: 'Add Additional Details (Optional)',
              description: 'Add phone numbers, job title, address, and any other relevant information. The more data you add, the more useful your CRM will be.',
            },
            {
              title: 'Link to an Account',
              description: 'If this contact works at a company you track, search for and select the account. This creates a relationship between the contact and account.',
            },
            {
              title: 'Add Tags',
              description: 'Apply tags to categorize the contact. For example: "VIP", "Newsletter", or "Trade Show Lead".',
            },
            {
              title: 'Save the Contact',
              description: 'Click the "Save" button. The contact is now created and will appear in your contacts list.',
            },
          ]}
        />
      </section>

      {/* Field Reference */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Field Reference
        </h2>

        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-3">
              Required Fields
            </h3>
            <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              {REQUIRED_FIELDS.map((item, index) => (
                <div
                  key={item.field}
                  className={`flex items-center justify-between p-4 ${
                    index < REQUIRED_FIELDS.length - 1 ? 'border-b border-slate-200 dark:border-slate-700' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-slate-900 dark:text-white">
                      {item.field}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400">
                      Required
                    </span>
                  </div>
                  <span className="text-sm text-slate-500">
                    {item.description}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-3">
              Optional Fields
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {OPTIONAL_FIELDS.map((item) => (
                <div
                  key={item.field}
                  className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700"
                >
                  <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500">
                    {item.icon}
                  </div>
                  <div>
                    <span className="font-medium text-slate-900 dark:text-white text-sm">
                      {item.field}
                    </span>
                    <p className="text-xs text-slate-500">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Keyboard Shortcut */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Quick Create Shortcut
        </h2>
        <div className="p-6 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <kbd className="px-3 py-2 bg-white dark:bg-slate-700 rounded-lg shadow text-lg font-mono text-slate-900 dark:text-white">
              ⌘
            </kbd>
            <span className="text-slate-500">+</span>
            <kbd className="px-3 py-2 bg-white dark:bg-slate-700 rounded-lg shadow text-lg font-mono text-slate-900 dark:text-white">
              N
            </kbd>
          </div>
          <div>
            <p className="font-medium text-slate-900 dark:text-white">
              Quick Create
            </p>
            <p className="text-sm text-slate-500">
              Press ⌘+N (Mac) or Ctrl+N (Windows) to quickly open the create menu from anywhere.
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
          <QuickTip title="Use Consistent Formatting" type="tip">
            Enter phone numbers in a consistent format (e.g., +1 555-123-4567).
            This makes searching and filtering easier later.
          </QuickTip>
          <QuickTip title="Link to Accounts Early" type="info">
            Always link contacts to their account/company when creating them.
            It's easier to do it now than to go back and update records later.
          </QuickTip>
          <QuickTip title="Avoid Duplicates" type="warning">
            Before creating a contact, search for them first to avoid duplicates.
            The CRM will warn you if an email already exists.
          </QuickTip>
        </div>
      </section>

      {/* Related Articles */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Related Articles
        </h2>
        <div className="grid gap-3">
          {[
            { title: 'Importing Contacts from CSV', href: '/crm/learn/contacts/importing' },
            { title: 'Merging Duplicate Contacts', href: '/crm/learn/contacts/merging' },
            { title: 'Adding Custom Fields', href: '/crm/learn/contacts/fields' },
          ].map((article) => (
            <Link
              key={article.href}
              href={article.href}
              className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 hover:border-teal-500/50 transition-colors group"
            >
              <span className="font-medium text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                {article.title}
              </span>
              <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-teal-500 transition-colors" />
            </Link>
          ))}
        </div>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-8">
        <Link href="/crm/learn/contacts">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Contacts
          </Button>
        </Link>
        <Link href="/crm/learn/contacts/importing">
          <Button className="gap-2">
            Next: Importing Contacts
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
