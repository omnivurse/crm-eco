'use client';

import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import {
  ArrowLeft,
  ArrowRight,
  Compass,
  Clock,
  CheckCircle,
  LayoutDashboard,
  Users,
  UserPlus,
  DollarSign,
  Mail,
  Zap,
  BarChart3,
  Settings,
  Search,
  Menu,
} from 'lucide-react';
import { AnimatedDemo, StepList, QuickTip } from '@/components/learn/AnimatedDemo';

const DEMO_STEPS = [
  {
    title: 'Main Navigation',
    description: 'The left sidebar contains all main modules of the CRM.',
    highlight: { x: 0, y: 0, width: 12, height: 100 },
    cursor: { x: 6, y: 50 },
    duration: 3000,
  },
  {
    title: 'Top Bar',
    description: 'Search, notifications, and your profile are in the top bar.',
    highlight: { x: 12, y: 0, width: 88, height: 8 },
    cursor: { x: 50, y: 4 },
    duration: 3000,
  },
  {
    title: 'Global Search',
    description: 'Click the search icon or press / to search across all modules.',
    highlight: { x: 35, y: 2, width: 30, height: 5 },
    cursor: { x: 50, y: 4 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Module Tabs',
    description: 'Within each module, tabs help you switch between views.',
    highlight: { x: 15, y: 12, width: 70, height: 6 },
    cursor: { x: 50, y: 15 },
    duration: 2500,
  },
  {
    title: 'Quick Actions',
    description: 'The + button lets you quickly create new records.',
    highlight: { x: 85, y: 10, width: 10, height: 5 },
    cursor: { x: 90, y: 12 },
    action: 'click' as const,
    duration: 2500,
  },
];

const NAV_ITEMS = [
  { icon: <LayoutDashboard className="w-5 h-5" />, name: 'Dashboard', description: 'Home and overview' },
  { icon: <Users className="w-5 h-5" />, name: 'Contacts', description: 'Customer database' },
  { icon: <UserPlus className="w-5 h-5" />, name: 'Leads', description: 'Potential customers' },
  { icon: <DollarSign className="w-5 h-5" />, name: 'Deals', description: 'Sales pipeline' },
  { icon: <Mail className="w-5 h-5" />, name: 'Campaigns', description: 'Mass email campaigns' },
  { icon: <Zap className="w-5 h-5" />, name: 'Sequences', description: 'Automated email flows' },
  { icon: <BarChart3 className="w-5 h-5" />, name: 'Reports', description: 'Analytics & insights' },
  { icon: <Settings className="w-5 h-5" />, name: 'Settings', description: 'Configuration' },
];

export default function NavigationPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/crm/learn" className="text-slate-500 hover:text-teal-600 transition-colors">
          Learning Center
        </Link>
        <span className="text-slate-400">/</span>
        <Link href="/crm/learn/getting-started" className="text-slate-500 hover:text-teal-600 transition-colors">
          Getting Started
        </Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-900 dark:text-white font-medium">Navigating the CRM</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500">
          <Compass className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Navigating the CRM
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Learn your way around the CRM interface and find things quickly.
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
          Interactive Demo
        </h2>
        <AnimatedDemo
          title="CRM Navigation Tour"
          steps={DEMO_STEPS}
        />
      </section>

      {/* Navigation Overview */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Main Navigation
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          The sidebar on the left contains all the main modules. Click any item to navigate
          to that section.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          {NAV_ITEMS.map((item) => (
            <div
              key={item.name}
              className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700"
            >
              <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400">
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

      {/* Key Features */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Key Navigation Features
        </h2>
        <div className="grid gap-4">
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <Search className="w-5 h-5 text-blue-500" />
              <h3 className="font-semibold text-slate-900 dark:text-white">Global Search</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Press <kbd className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs">/</kbd> or
              click the search bar to search across all records. Find contacts, deals, emails, and more instantly.
            </p>
          </div>
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <Menu className="w-5 h-5 text-emerald-500" />
              <h3 className="font-semibold text-slate-900 dark:text-white">Breadcrumbs</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              The breadcrumb trail at the top shows your current location. Click any part to jump
              back to that level.
            </p>
          </div>
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <Zap className="w-5 h-5 text-amber-500" />
              <h3 className="font-semibold text-slate-900 dark:text-white">Quick Create</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              The + button in the header lets you quickly create contacts, deals, tasks, and more
              from anywhere in the app.
            </p>
          </div>
        </div>
      </section>

      {/* Keyboard Shortcuts */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Keyboard Shortcuts
        </h2>
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="grid grid-cols-2 gap-4 p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <div className="text-sm font-medium text-slate-500 uppercase tracking-wider">Shortcut</div>
            <div className="text-sm font-medium text-slate-500 uppercase tracking-wider">Action</div>
          </div>
          {[
            { key: '/', action: 'Open global search' },
            { key: 'G then D', action: 'Go to Dashboard' },
            { key: 'G then C', action: 'Go to Contacts' },
            { key: 'G then L', action: 'Go to Leads' },
            { key: 'G then P', action: 'Go to Pipeline (Deals)' },
            { key: 'N', action: 'New record (in current module)' },
            { key: '?', action: 'Show all shortcuts' },
          ].map((shortcut) => (
            <div key={shortcut.key} className="grid grid-cols-2 gap-4 p-4 border-b last:border-b-0 border-slate-200 dark:border-slate-700">
              <div>
                <kbd className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-sm font-mono text-slate-700 dark:text-slate-300">
                  {shortcut.key}
                </kbd>
              </div>
              <div className="text-slate-600 dark:text-slate-400">{shortcut.action}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Tips */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Navigation Tips
        </h2>
        <div className="space-y-4">
          <QuickTip title="Use Keyboard Shortcuts" type="tip">
            Once you learn a few shortcuts, navigating becomes much faster.
            Press ? anywhere to see all available shortcuts.
          </QuickTip>
          <QuickTip title="Collapse the Sidebar" type="info">
            On smaller screens or when you need more space, click the hamburger
            icon to collapse the sidebar to icons only.
          </QuickTip>
          <QuickTip title="Browser Back Button" type="info">
            You can use your browser's back and forward buttons to navigate
            through your recent views.
          </QuickTip>
        </div>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-8">
        <Link href="/crm/learn/getting-started/profile">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Previous: Your Profile
          </Button>
        </Link>
        <Link href="/crm/learn/contacts">
          <Button className="gap-2">
            Next: Managing Contacts
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
