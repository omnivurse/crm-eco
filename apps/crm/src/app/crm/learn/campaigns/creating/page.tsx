'use client';

import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import {
  ArrowLeft,
  ArrowRight,
  Mail,
  Clock,
  CheckCircle,
  Plus,
  FileText,
  Users,
  Send,
  Eye,
  MousePointer,
  Calendar,
  Settings,
} from 'lucide-react';
import { AnimatedDemo, StepList, QuickTip } from '@/components/learn/AnimatedDemo';

const DEMO_STEPS = [
  {
    title: 'Navigate to Campaigns',
    description: 'Click "Campaigns" in the main navigation to view your email campaigns.',
    cursor: { x: 35, y: 7 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Click "New Campaign"',
    description: 'Click the "New Campaign" button to start creating your email.',
    highlight: { x: 80, y: 15, width: 18, height: 6 },
    cursor: { x: 88, y: 18 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Enter Campaign Name',
    description: 'Give your campaign a name (internal use only, recipients won\'t see this).',
    highlight: { x: 20, y: 18, width: 60, height: 10 },
    cursor: { x: 50, y: 23 },
    action: 'type' as const,
    duration: 2500,
  },
  {
    title: 'Write Subject Line',
    description: 'Craft a compelling subject line. This is what recipients see in their inbox.',
    highlight: { x: 20, y: 30, width: 60, height: 10 },
    cursor: { x: 50, y: 35 },
    action: 'type' as const,
    duration: 3000,
  },
  {
    title: 'Compose Email Body',
    description: 'Write your email content. Use merge fields to personalize.',
    highlight: { x: 20, y: 42, width: 60, height: 30 },
    cursor: { x: 50, y: 55 },
    action: 'type' as const,
    duration: 4000,
  },
  {
    title: 'Select Recipients',
    description: 'Choose who receives this email from a view, filter, or manual selection.',
    highlight: { x: 20, y: 74, width: 30, height: 10 },
    cursor: { x: 35, y: 79 },
    action: 'click' as const,
    duration: 3000,
  },
  {
    title: 'Send or Schedule',
    description: 'Click "Send Now" to send immediately, or "Schedule" to send later.',
    highlight: { x: 70, y: 74, width: 25, height: 10 },
    cursor: { x: 82, y: 79 },
    action: 'click' as const,
    duration: 3000,
  },
];

const MERGE_FIELDS = [
  { field: '{{contact.first_name}}', example: 'John', description: 'First name' },
  { field: '{{contact.last_name}}', example: 'Smith', description: 'Last name' },
  { field: '{{contact.company}}', example: 'Acme Corp', description: 'Company name' },
  { field: '{{user.name}}', example: 'Sarah', description: 'Your name (sender)' },
];

export default function CreatingCampaignsPage() {
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
        <span className="text-slate-900 dark:text-white font-medium">Creating a Campaign</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500">
          <Mail className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Creating an Email Campaign
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Learn how to create and send mass emails to your contacts.
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
          Video Walkthrough
        </h2>
        <AnimatedDemo
          title="Creating a Campaign"
          steps={DEMO_STEPS}
        />
      </section>

      {/* What is a Campaign */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          What is an Email Campaign?
        </h2>
        <div className="p-6 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            An <strong>Email Campaign</strong> is a single email sent to multiple recipients at once.
            Unlike sequences (which send multiple emails over time), campaigns are one-time sends
            perfect for newsletters, announcements, promotions, and updates.
          </p>
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="text-center p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
              <Eye className="w-8 h-8 mx-auto mb-2 text-blue-500" />
              <span className="text-sm font-medium text-slate-900 dark:text-white">Track Opens</span>
            </div>
            <div className="text-center p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
              <MousePointer className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
              <span className="text-sm font-medium text-slate-900 dark:text-white">Track Clicks</span>
            </div>
            <div className="text-center p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
              <Calendar className="w-8 h-8 mx-auto mb-2 text-amber-500" />
              <span className="text-sm font-medium text-slate-900 dark:text-white">Schedule Sends</span>
            </div>
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
              title: 'Go to Campaigns',
              description: 'Navigate to the Campaigns module from the main navigation.',
            },
            {
              title: 'Click "New Campaign"',
              description: 'Click the "New Campaign" button to open the campaign composer.',
            },
            {
              title: 'Enter Campaign Name',
              description: 'Give your campaign an internal name (e.g., "March Newsletter 2024"). Recipients won\'t see this.',
            },
            {
              title: 'Write Your Subject Line',
              description: 'Craft a compelling subject line under 50 characters. This is what recipients see in their inbox.',
            },
            {
              title: 'Compose the Email Body',
              description: 'Write your email content. Use the formatting toolbar for bold, links, images, etc.',
            },
            {
              title: 'Add Merge Fields',
              description: 'Insert merge fields like {{contact.first_name}} to personalize each email.',
            },
            {
              title: 'Select Recipients',
              description: 'Choose recipients from a saved view, filter, or manually select contacts.',
            },
            {
              title: 'Preview & Test',
              description: 'Send a test email to yourself to check formatting and merge fields.',
            },
            {
              title: 'Send or Schedule',
              description: 'Click "Send Now" to send immediately, or schedule for a future date/time.',
            },
          ]}
        />
      </section>

      {/* Merge Fields */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Using Merge Fields
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Merge fields are placeholders that get replaced with actual contact data when the email is sent.
        </p>
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 font-medium text-sm text-slate-600 dark:text-slate-400">
            <div className="col-span-5">Merge Field</div>
            <div className="col-span-3">Example</div>
            <div className="col-span-4">Description</div>
          </div>
          {MERGE_FIELDS.map((item, index) => (
            <div
              key={item.field}
              className={`grid grid-cols-12 gap-4 p-4 items-center ${
                index < MERGE_FIELDS.length - 1 ? 'border-b border-slate-200 dark:border-slate-700' : ''
              }`}
            >
              <div className="col-span-5">
                <code className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-sm text-teal-600 dark:text-teal-400">
                  {item.field}
                </code>
              </div>
              <div className="col-span-3 text-sm text-slate-600 dark:text-slate-400">
                {item.example}
              </div>
              <div className="col-span-4 text-sm text-slate-600 dark:text-slate-400">
                {item.description}
              </div>
            </div>
          ))}
        </div>
        <QuickTip title="Example Usage" type="info">
          <p className="mb-2">In your email, write:</p>
          <code className="block p-3 bg-slate-100 dark:bg-slate-800 rounded text-sm mb-2">
            Hi {'{{contact.first_name}}'},
          </code>
          <p>When sent to John Smith, it becomes:</p>
          <code className="block p-3 bg-slate-100 dark:bg-slate-800 rounded text-sm">
            Hi John,
          </code>
        </QuickTip>
      </section>

      {/* Recipient Selection */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Selecting Recipients
        </h2>
        <div className="grid gap-4">
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white">From a Saved View</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Select a saved view (e.g., "Active Customers" or "Newsletter Subscribers") and all
              contacts matching that view's filters will receive the email.
            </p>
          </div>
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400">
                <Settings className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white">With Custom Filters</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Build filters on-the-fly to target specific contacts. For example: "Status is Active"
              AND "Tag contains VIP" AND "Last contacted more than 30 days ago."
            </p>
          </div>
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <CheckCircle className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Manual Selection</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Hand-pick specific contacts from a list. Best for small, targeted sends where you
              know exactly who should receive the email.
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
          <QuickTip title="Always Send a Test" type="tip">
            Before sending to your full list, send a test email to yourself. Check that merge
            fields work, links are correct, and formatting looks good on desktop and mobile.
          </QuickTip>
          <QuickTip title="Optimal Send Times" type="info">
            For B2B emails, Tuesday-Thursday between 10am-2pm tends to get the best engagement.
            For B2C, test weekends. Always send based on the recipient's timezone when possible.
          </QuickTip>
          <QuickTip title="Subject Line Tips" type="tip">
            Keep subject lines under 50 characters, be specific about what's inside, and avoid
            spam trigger words like "FREE" or "URGENT". Test different approaches to see what works.
          </QuickTip>
          <QuickTip title="Respect Unsubscribes" type="warning">
            Every campaign automatically includes an unsubscribe link. Never remove it, and always
            honor unsubscribe requests immediately. This is required by law (CAN-SPAM, GDPR).
          </QuickTip>
        </div>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-8">
        <Link href="/crm/learn/campaigns">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Campaigns
          </Button>
        </Link>
        <Link href="/crm/learn/campaigns/recipients">
          <Button className="gap-2">
            Next: Selecting Recipients
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
