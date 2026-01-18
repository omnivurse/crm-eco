'use client';

import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import {
  ArrowLeft,
  ArrowRight,
  LayoutDashboard,
  Clock,
  CheckCircle,
  BarChart3,
  Calendar,
  Users,
  Target,
  Bell,
  Activity,
} from 'lucide-react';
import { AnimatedDemo, StepList, QuickTip } from '@/components/learn/AnimatedDemo';

const DEMO_STEPS = [
  {
    title: 'Access Dashboard',
    description: 'Click "Dashboard" in the main navigation or the home icon.',
    cursor: { x: 8, y: 12 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'View Key Metrics',
    description: 'See your most important KPIs at a glance in the metrics cards.',
    highlight: { x: 5, y: 20, width: 90, height: 15 },
    cursor: { x: 50, y: 27 },
    duration: 3000,
  },
  {
    title: 'Check Activity Feed',
    description: 'The activity feed shows recent actions by you and your team.',
    highlight: { x: 60, y: 40, width: 35, height: 40 },
    cursor: { x: 77, y: 60 },
    duration: 3000,
  },
  {
    title: 'Review Tasks',
    description: 'Your upcoming tasks and deadlines are displayed prominently.',
    highlight: { x: 5, y: 40, width: 50, height: 20 },
    cursor: { x: 30, y: 50 },
    duration: 2500,
  },
  {
    title: 'Customize Widgets',
    description: 'Click the settings icon to add, remove, or rearrange dashboard widgets.',
    highlight: { x: 90, y: 5, width: 5, height: 5 },
    cursor: { x: 92, y: 7 },
    action: 'click' as const,
    duration: 2500,
  },
];

const DASHBOARD_WIDGETS = [
  { name: 'Pipeline Summary', icon: <Target className="w-5 h-5" />, description: 'Total value by stage with quick actions' },
  { name: 'Activity Timeline', icon: <Activity className="w-5 h-5" />, description: 'Recent activities from your team' },
  { name: 'Tasks Due', icon: <CheckCircle className="w-5 h-5" />, description: 'Upcoming tasks and deadlines' },
  { name: 'Performance Chart', icon: <BarChart3 className="w-5 h-5" />, description: 'Sales performance over time' },
  { name: 'Calendar', icon: <Calendar className="w-5 h-5" />, description: 'Meetings and appointments' },
  { name: 'Team Leaderboard', icon: <Users className="w-5 h-5" />, description: 'Top performers this period' },
];

export default function DashboardPage() {
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
        <span className="text-slate-900 dark:text-white font-medium">Understanding the Dashboard</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500">
          <LayoutDashboard className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Understanding the Dashboard
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Your command center for tracking performance and staying on top of tasks.
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
          title="Navigating the Dashboard"
          steps={DEMO_STEPS}
        />
      </section>

      {/* Dashboard Overview */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Dashboard Overview
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          The dashboard is your home base in CRM Eco. It provides a real-time snapshot of your
          sales activities, upcoming tasks, and team performance. Everything you need to start
          your day is visible at a glance.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { icon: <BarChart3 className="w-5 h-5" />, title: 'Key Metrics', description: 'Track deals, revenue, and conversion rates' },
            { icon: <Bell className="w-5 h-5" />, title: 'Notifications', description: 'See updates requiring your attention' },
            { icon: <CheckCircle className="w-5 h-5" />, title: 'Task Management', description: 'View and complete upcoming tasks' },
            { icon: <Activity className="w-5 h-5" />, title: 'Activity Stream', description: 'Follow what your team is doing' },
          ].map((feature) => (
            <div
              key={feature.title}
              className="flex items-start gap-3 p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700"
            >
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                {feature.icon}
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">{feature.title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Available Widgets */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Available Widgets
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Customize your dashboard with these widgets:
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          {DASHBOARD_WIDGETS.map((widget) => (
            <div
              key={widget.name}
              className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700"
            >
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {widget.icon}
              </div>
              <div>
                <h3 className="font-medium text-slate-900 dark:text-white">{widget.name}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{widget.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Step by Step */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Customizing Your Dashboard
        </h2>
        <StepList
          steps={[
            {
              title: 'Access Dashboard Settings',
              description: 'Click the gear icon in the top-right corner of the dashboard.',
            },
            {
              title: 'Add Widgets',
              description: 'Click "Add Widget" and select from the available options.',
            },
            {
              title: 'Rearrange Layout',
              description: 'Drag and drop widgets to reposition them on your dashboard.',
            },
            {
              title: 'Resize Widgets',
              description: 'Some widgets can be resized. Drag the corner to adjust.',
            },
            {
              title: 'Remove Widgets',
              description: 'Click the X on any widget to remove it from your dashboard.',
            },
            {
              title: 'Save Changes',
              description: 'Your layout is saved automatically per user.',
            },
          ]}
        />
      </section>

      {/* Tips */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Dashboard Tips
        </h2>
        <div className="space-y-4">
          <QuickTip title="Start Your Day Here" type="tip">
            Make it a habit to check your dashboard first thing. Review tasks due today,
            check for notifications, and plan your priorities.
          </QuickTip>
          <QuickTip title="Focus on What Matters" type="info">
            Remove widgets you don't use daily. A focused dashboard helps you concentrate
            on the metrics that drive your success.
          </QuickTip>
        </div>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-8">
        <Link href="/crm/learn/getting-started">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Getting Started
          </Button>
        </Link>
        <Link href="/crm/learn/getting-started/profile">
          <Button className="gap-2">
            Next: Setting Up Your Profile
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
