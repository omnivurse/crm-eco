'use client';

import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import {
  ArrowLeft,
  ArrowRight,
  Mail,
  Clock,
  Play,
  CheckCircle,
  Users,
  FileEdit,
  BarChart3,
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
    description: 'Click on "Campaigns" in the main navigation to access your email campaigns.',
    cursor: { x: 35, y: 7 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Create New Campaign',
    description: 'Click the "New Campaign" button to start creating your email.',
    highlight: { x: 80, y: 15, width: 18, height: 6 },
    cursor: { x: 88, y: 18 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Write Your Email',
    description: 'Compose your subject line and email body. Use merge fields to personalize.',
    highlight: { x: 20, y: 25, width: 60, height: 50 },
    cursor: { x: 50, y: 45 },
    action: 'type' as const,
    duration: 4000,
  },
  {
    title: 'Select Recipients',
    description: 'Choose who will receive this email - from a view, filter, or manual selection.',
    highlight: { x: 22, y: 78, width: 25, height: 8 },
    cursor: { x: 35, y: 82 },
    action: 'click' as const,
    duration: 3000,
  },
  {
    title: 'Send or Schedule',
    description: 'Send immediately or schedule for the optimal time.',
    highlight: { x: 70, y: 78, width: 25, height: 8 },
    cursor: { x: 82, y: 82 },
    action: 'click' as const,
    duration: 3000,
  },
];

const ARTICLES = [
  {
    title: 'Creating a Campaign',
    description: 'Step-by-step guide to building effective email campaigns',
    time: '5 min',
    href: '/crm/learn/campaigns/creating',
    icon: <Mail className="w-5 h-5" />,
  },
  {
    title: 'Selecting Recipients',
    description: 'How to choose the right audience for your emails',
    time: '4 min',
    href: '/crm/learn/campaigns/recipients',
    icon: <Users className="w-5 h-5" />,
  },
  {
    title: 'Using Email Templates',
    description: 'Create and manage reusable email templates',
    time: '4 min',
    href: '/crm/learn/campaigns/templates',
    icon: <FileEdit className="w-5 h-5" />,
  },
  {
    title: 'Merge Fields & Personalization',
    description: 'Personalize emails with dynamic content',
    time: '4 min',
    href: '/crm/learn/campaigns/personalization',
    icon: <Settings className="w-5 h-5" />,
  },
  {
    title: 'Scheduling Campaigns',
    description: 'Schedule emails for the optimal send time',
    time: '3 min',
    href: '/crm/learn/campaigns/scheduling',
    icon: <Calendar className="w-5 h-5" />,
  },
  {
    title: 'Tracking & Analytics',
    description: 'Monitor open rates, clicks, and engagement',
    time: '5 min',
    href: '/crm/learn/campaigns/analytics',
    icon: <BarChart3 className="w-5 h-5" />,
  },
];

const MERGE_FIELDS = [
  { field: '{{contact.first_name}}', description: 'Recipient\'s first name' },
  { field: '{{contact.last_name}}', description: 'Recipient\'s last name' },
  { field: '{{contact.email}}', description: 'Recipient\'s email address' },
  { field: '{{contact.company}}', description: 'Recipient\'s company name' },
  { field: '{{user.name}}', description: 'Your name (sender)' },
  { field: '{{user.email}}', description: 'Your email address' },
];

export default function CampaignsLearnPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/crm/learn" className="text-slate-500 hover:text-teal-600 transition-colors">
          Learning Center
        </Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-900 dark:text-white font-medium">Email Campaigns</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500">
          <Mail className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Email Campaigns
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Create, send, and track mass email campaigns to engage your audience.
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

      {/* Campaign Demo */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Creating Your First Campaign
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Watch this walkthrough to see how easy it is to create and send an email campaign.
        </p>
        <AnimatedDemo
          title="Campaign Creation"
          steps={DEMO_STEPS}
        />
      </section>

      {/* Quick Stats */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-500/10 dark:to-cyan-500/10 border border-blue-200 dark:border-blue-500/30">
          <div className="flex items-center gap-3 mb-3">
            <Eye className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <span className="font-semibold text-slate-900 dark:text-white">Open Rate</span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Track how many recipients opened your email. Industry average is 20-25%.
          </p>
        </div>
        <div className="p-5 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-500/10 dark:to-emerald-500/10 border border-green-200 dark:border-green-500/30">
          <div className="flex items-center gap-3 mb-3">
            <MousePointer className="w-6 h-6 text-green-600 dark:text-green-400" />
            <span className="font-semibold text-slate-900 dark:text-white">Click Rate</span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Measure engagement by tracking link clicks. Aim for 2-5% click-through rate.
          </p>
        </div>
        <div className="p-5 rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-500/10 dark:to-purple-500/10 border border-violet-200 dark:border-violet-500/30">
          <div className="flex items-center gap-3 mb-3">
            <Send className="w-6 h-6 text-violet-600 dark:text-violet-400" />
            <span className="font-semibold text-slate-900 dark:text-white">Delivery Rate</span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Monitor successful deliveries. Keep bounce rates below 2% for healthy lists.
          </p>
        </div>
      </section>

      {/* Merge Fields Reference */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Personalization with Merge Fields
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Make your emails personal by using merge fields. These placeholders get replaced
          with actual data when the email is sent.
        </p>
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">
                  Merge Field
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">
                  Description
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {MERGE_FIELDS.map((item) => (
                <tr key={item.field}>
                  <td className="px-4 py-3">
                    <code className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-sm text-teal-600 dark:text-teal-400">
                      {item.field}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                    {item.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
              <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 group-hover:bg-teal-100 dark:group-hover:bg-teal-500/20 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
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

      {/* Best Practices */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Email Best Practices
        </h2>
        <div className="space-y-4">
          <QuickTip title="Write Compelling Subject Lines" type="tip">
            Keep subjects under 50 characters, be specific, and create urgency.
            Avoid ALL CAPS and excessive punctuation!!!
          </QuickTip>
          <QuickTip title="Optimal Send Times" type="info">
            For B2B: Tuesday-Thursday, 10am or 2pm work best.
            For B2C: Test weekends. Always send based on recipient's timezone.
          </QuickTip>
          <QuickTip title="Avoid Spam Triggers" type="warning">
            Words like "FREE", "URGENT", or "Act Now" can trigger spam filters.
            Balance images with text and always include an unsubscribe link.
          </QuickTip>
        </div>
      </section>

      {/* Step-by-Step */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Campaign Workflow
        </h2>
        <StepList
          steps={[
            {
              title: 'Define Your Goal',
              description: 'What do you want recipients to do? Buy, register, read, download?',
            },
            {
              title: 'Segment Your Audience',
              description: 'Target the right people with relevant content. Quality over quantity.',
            },
            {
              title: 'Craft Your Message',
              description: 'Write clear, compelling copy. Personalize with merge fields.',
            },
            {
              title: 'Design & Test',
              description: 'Make it visually appealing. Send test emails to yourself first.',
            },
            {
              title: 'Schedule & Send',
              description: 'Choose the optimal time and hit send with confidence.',
            },
            {
              title: 'Analyze Results',
              description: 'Review metrics, learn what worked, and improve next time.',
            },
          ]}
        />
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-8">
        <Link href="/crm/learn/deals">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Previous: Deals & Pipeline
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
