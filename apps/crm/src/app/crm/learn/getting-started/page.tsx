'use client';

import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  ArrowLeft,
  ArrowRight,
  Rocket,
  CheckCircle,
  Clock,
  Play,
  Users,
  Layout,
  Settings,
  Zap,
  Target,
  Mail,
  BarChart3,
} from 'lucide-react';
import { AnimatedDemo, StepList, QuickTip } from '@/components/learn/AnimatedDemo';

// Demo steps for navigating the dashboard
const DASHBOARD_DEMO_STEPS = [
  {
    title: 'Welcome to Your Dashboard',
    description: 'This is your central hub for all CRM activities. Let\'s explore what\'s here.',
    cursor: { x: 50, y: 50 },
    duration: 3000,
  },
  {
    title: 'Module Navigation',
    description: 'Use the top navigation to switch between Contacts, Leads, Deals, and more.',
    highlight: { x: 15, y: 5, width: 70, height: 8 },
    cursor: { x: 30, y: 8 },
    action: 'hover' as const,
    duration: 4000,
  },
  {
    title: 'Quick Actions',
    description: 'Create new records, log activities, and access frequently used features here.',
    highlight: { x: 80, y: 5, width: 18, height: 8 },
    cursor: { x: 88, y: 8 },
    action: 'click' as const,
    duration: 4000,
  },
  {
    title: 'Sidebar Navigation',
    description: 'Access views, filters, and module-specific options from the sidebar.',
    highlight: { x: 0, y: 15, width: 20, height: 80 },
    cursor: { x: 10, y: 40 },
    duration: 4000,
  },
  {
    title: 'Main Content Area',
    description: 'Your records, pipeline views, and data are displayed in this central area.',
    highlight: { x: 22, y: 15, width: 76, height: 80 },
    cursor: { x: 55, y: 50 },
    duration: 3000,
  },
];

// Demo steps for creating a contact
const CREATE_CONTACT_DEMO_STEPS = [
  {
    title: 'Click the + Button',
    description: 'Start by clicking the "+" button in the top right corner.',
    cursor: { x: 90, y: 6 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Select "Contact"',
    description: 'Choose "Contact" from the dropdown menu to create a new contact.',
    highlight: { x: 75, y: 10, width: 20, height: 6 },
    cursor: { x: 85, y: 12 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Fill in Details',
    description: 'Enter the contact\'s name, email, phone, and other relevant information.',
    highlight: { x: 30, y: 20, width: 40, height: 60 },
    cursor: { x: 50, y: 30 },
    action: 'type' as const,
    duration: 3500,
  },
  {
    title: 'Save the Contact',
    description: 'Click "Save" to create the contact. It will now appear in your contacts list.',
    highlight: { x: 55, y: 75, width: 15, height: 6 },
    cursor: { x: 62, y: 78 },
    action: 'click' as const,
    duration: 2500,
  },
];

const QUICK_START_STEPS = [
  {
    title: 'Set up your profile',
    description: 'Add your name, photo, and contact details so team members can identify you.',
  },
  {
    title: 'Import or add contacts',
    description: 'Bring in your existing contacts via CSV import or add them manually.',
  },
  {
    title: 'Create your first deal',
    description: 'Add a potential opportunity and start tracking it through your pipeline.',
  },
  {
    title: 'Customize your views',
    description: 'Set up filters and saved views to organize your data the way you work.',
  },
  {
    title: 'Invite team members',
    description: 'Collaborate by inviting colleagues to your CRM workspace.',
  },
];

const RELATED_ARTICLES = [
  {
    title: 'Understanding the Dashboard',
    time: '3 min',
    href: '/crm/learn/getting-started/dashboard',
    icon: <Layout className="w-5 h-5" />,
  },
  {
    title: 'Setting Up Your Profile',
    time: '2 min',
    href: '/crm/learn/getting-started/profile',
    icon: <Settings className="w-5 h-5" />,
  },
  {
    title: 'Creating Your First Contact',
    time: '3 min',
    href: '/crm/learn/contacts/creating',
    icon: <Users className="w-5 h-5" />,
  },
  {
    title: 'Pipeline Overview',
    time: '4 min',
    href: '/crm/learn/deals/pipeline',
    icon: <Target className="w-5 h-5" />,
  },
];

export default function GettingStartedPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/crm/learn" className="text-slate-500 hover:text-teal-600 transition-colors">
          Learning Center
        </Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-900 dark:text-white font-medium">Getting Started</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500">
          <Rocket className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Quick Start Guide
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Get up and running with CRM Eco in just 5 minutes. This guide will walk you
            through the essentials.
          </p>
          <div className="flex items-center gap-4 mt-4 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              5 min read
            </span>
            <span className="flex items-center gap-1">
              <Play className="w-4 h-4" />
              2 video demos
            </span>
          </div>
        </div>
      </div>

      {/* Table of Contents */}
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6">
        <h2 className="font-semibold text-slate-900 dark:text-white mb-4">
          In this guide
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            'Welcome to CRM Eco',
            'Navigating the Dashboard',
            'Creating Your First Record',
            'Next Steps',
          ].map((item, index) => (
            <a
              key={index}
              href={`#section-${index + 1}`}
              className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
            >
              <span className="w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center text-sm font-medium">
                {index + 1}
              </span>
              {item}
            </a>
          ))}
        </div>
      </div>

      {/* Section 1: Welcome */}
      <section id="section-1" className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Welcome to CRM Eco
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          CRM Eco is a powerful customer relationship management platform designed to help
          you manage contacts, track leads, close deals, and automate your sales process.
          Whether you're a solo entrepreneur or part of a sales team, CRM Eco adapts to
          your workflow.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {[
            {
              icon: <Users className="w-6 h-6" />,
              title: 'Manage Relationships',
              description: 'Keep all your contacts and accounts organized in one place.',
            },
            {
              icon: <Target className="w-6 h-6" />,
              title: 'Track Opportunities',
              description: 'Follow deals through your sales pipeline from lead to close.',
            },
            {
              icon: <Zap className="w-6 h-6" />,
              title: 'Automate Tasks',
              description: 'Set up workflows and sequences to save time on repetitive tasks.',
            },
          ].map((item, index) => (
            <div
              key={index}
              className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700"
            >
              <div className="w-12 h-12 rounded-xl bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-4">
                {item.icon}
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
                {item.title}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Section 2: Dashboard Demo */}
      <section id="section-2" className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Navigating the Dashboard
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Let's take a tour of the main dashboard. Click play to see an interactive
          walkthrough of the key areas.
        </p>

        <AnimatedDemo
          title="Dashboard Tour"
          steps={DASHBOARD_DEMO_STEPS}
        />

        <QuickTip title="Pro Tip" type="tip">
          Use the keyboard shortcut <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-sm">⌘K</kbd> (or <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-sm">Ctrl+K</kbd> on Windows)
          to open the command palette and quickly navigate anywhere in the CRM.
        </QuickTip>
      </section>

      {/* Section 3: Create First Record */}
      <section id="section-3" className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Creating Your First Record
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Now let's create your first contact. Follow along with this demo or use the
          step-by-step instructions below.
        </p>

        <AnimatedDemo
          title="Creating a Contact"
          steps={CREATE_CONTACT_DEMO_STEPS}
        />

        <div className="mt-6">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">
            Step-by-Step Instructions
          </h3>
          <StepList
            steps={[
              {
                title: 'Click the "+" button',
                description: 'Find the plus button in the top right corner of the screen and click it.',
              },
              {
                title: 'Select record type',
                description: 'Choose "Contact" from the dropdown menu. You can also create Leads, Deals, or Accounts.',
              },
              {
                title: 'Fill in the details',
                description: 'Enter at minimum a name and email. You can add phone, company, and other details too.',
              },
              {
                title: 'Save your contact',
                description: 'Click "Save" and your new contact will appear in the contacts list.',
              },
            ]}
          />
        </div>

        <QuickTip title="Good to know" type="info">
          You can also import contacts in bulk from a CSV file. Go to <strong>Contacts → Import</strong> to
          upload your existing contact list.
        </QuickTip>
      </section>

      {/* Section 4: Next Steps */}
      <section id="section-4" className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Next Steps
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Great job! You now know the basics. Here's what we recommend doing next:
        </p>

        <StepList steps={QUICK_START_STEPS} />
      </section>

      {/* Related Articles */}
      <div className="border-t border-slate-200 dark:border-slate-700 pt-8">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
          Related Articles
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {RELATED_ARTICLES.map((article) => (
            <Link
              key={article.href}
              href={article.href}
              className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 hover:border-teal-500/50 transition-all group"
            >
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 group-hover:bg-teal-500/10 group-hover:text-teal-500 transition-colors">
                {article.icon}
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                  {article.title}
                </h3>
                <div className="flex items-center gap-1 text-sm text-slate-500">
                  <Clock className="w-3 h-3" />
                  {article.time}
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-teal-500 transition-colors" />
            </Link>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-8">
        <Link href="/crm/learn">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Learning Center
          </Button>
        </Link>
        <Link href="/crm/learn/getting-started/dashboard">
          <Button className="gap-2">
            Next: Dashboard Overview
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
