'use client';

import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import {
  ArrowLeft,
  ArrowRight,
  UserCheck,
  Clock,
  CheckCircle,
  RefreshCw,
  MapPin,
  Users,
  Shuffle,
  Settings,
  Zap,
} from 'lucide-react';
import { AnimatedDemo, StepList, QuickTip } from '@/components/learn/AnimatedDemo';

const DEMO_STEPS = [
  {
    title: 'Go to Settings',
    description: 'Navigate to Settings from your profile menu.',
    cursor: { x: 92, y: 5 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Select Assignment Rules',
    description: 'Click on "Assignment Rules" under the Leads section.',
    cursor: { x: 15, y: 45 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Create New Rule',
    description: 'Click "Add Rule" to create an assignment rule.',
    highlight: { x: 70, y: 20, width: 15, height: 5 },
    cursor: { x: 77, y: 22 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Set Conditions',
    description: 'Define conditions that determine when this rule applies.',
    highlight: { x: 15, y: 30, width: 70, height: 25 },
    cursor: { x: 50, y: 42 },
    duration: 3500,
  },
  {
    title: 'Choose Assignment',
    description: 'Select who leads matching this rule should be assigned to.',
    highlight: { x: 15, y: 58, width: 70, height: 18 },
    cursor: { x: 50, y: 67 },
    action: 'click' as const,
    duration: 3000,
  },
];

const ASSIGNMENT_METHODS = [
  {
    icon: <Shuffle className="w-5 h-5" />,
    title: 'Round Robin',
    description: 'Distribute leads evenly among team members in rotation.',
    best: 'Teams with equal capacity',
  },
  {
    icon: <MapPin className="w-5 h-5" />,
    title: 'Territory-Based',
    description: 'Assign leads based on geographic location or region.',
    best: 'Field sales with territories',
  },
  {
    icon: <Users className="w-5 h-5" />,
    title: 'Skill-Based',
    description: 'Route leads to reps with specific expertise or product knowledge.',
    best: 'Complex products or services',
  },
  {
    icon: <Zap className="w-5 h-5" />,
    title: 'Load Balanced',
    description: 'Assign based on current workload and capacity.',
    best: 'Varying rep availability',
  },
];

export default function AssignmentPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/crm/learn" className="text-slate-500 hover:text-teal-600 transition-colors">
          Learning Center
        </Link>
        <span className="text-slate-400">/</span>
        <Link href="/crm/learn/leads" className="text-slate-500 hover:text-teal-600 transition-colors">
          Leads
        </Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-900 dark:text-white font-medium">Lead Assignment</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500">
          <UserCheck className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Lead Assignment Rules
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Automatically route leads to the right sales reps based on your criteria.
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
          title="Setting Up Assignment Rules"
          steps={DEMO_STEPS}
        />
      </section>

      {/* Why Use Assignment Rules */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Why Use Assignment Rules?
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Automated lead assignment ensures leads are handled quickly and by the right people:
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { icon: <Clock className="w-5 h-5" />, title: 'Faster Response', description: 'Leads are assigned instantly, no manual routing' },
            { icon: <CheckCircle className="w-5 h-5" />, title: 'Fair Distribution', description: 'Evenly spread leads across your team' },
            { icon: <UserCheck className="w-5 h-5" />, title: 'Better Fit', description: 'Match leads to reps with relevant expertise' },
            { icon: <RefreshCw className="w-5 h-5" />, title: 'Consistent Process', description: 'Same rules apply every time, no exceptions' },
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

      {/* Assignment Methods */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Assignment Methods
        </h2>
        <div className="grid gap-4">
          {ASSIGNMENT_METHODS.map((method) => (
            <div
              key={method.title}
              className="flex items-start gap-4 p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700"
            >
              <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                {method.icon}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-1">{method.title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">{method.description}</p>
                <p className="text-xs text-slate-500">Best for: {method.best}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Step by Step */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Creating Assignment Rules
        </h2>
        <StepList
          steps={[
            {
              title: 'Access Assignment Settings',
              description: 'Go to Settings → Leads → Assignment Rules.',
            },
            {
              title: 'Create a New Rule',
              description: 'Click "Add Rule" and give it a descriptive name.',
            },
            {
              title: 'Define Conditions',
              description: 'Set criteria like lead source, location, industry, or company size.',
            },
            {
              title: 'Choose Assignment Method',
              description: 'Select round-robin, specific user, or custom logic.',
            },
            {
              title: 'Set Priority',
              description: 'If multiple rules match, priority determines which applies.',
            },
            {
              title: 'Activate the Rule',
              description: 'Toggle the rule active. Test with a sample lead.',
            },
          ]}
        />
      </section>

      {/* Example Rule */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Example Rule Configuration
        </h2>
        <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Enterprise Leads → Senior Sales Team</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-500 w-24">IF</span>
              <code className="px-3 py-1 rounded bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                Company Size &gt; 500 employees
              </code>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-500 w-24">AND</span>
              <code className="px-3 py-1 rounded bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                Lead Source = Website
              </code>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-500 w-24">THEN</span>
              <code className="px-3 py-1 rounded bg-emerald-50 dark:bg-emerald-500/20 text-sm text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                Round-robin to: Senior Sales Team
              </code>
            </div>
          </div>
        </div>
      </section>

      {/* Tips */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Assignment Best Practices
        </h2>
        <div className="space-y-4">
          <QuickTip title="Start with Simple Rules" type="tip">
            Begin with broad rules and add specificity over time. Complex rules
            are harder to debug when leads aren't routing correctly.
          </QuickTip>
          <QuickTip title="Include a Catch-All" type="info">
            Create a default rule that catches any leads not matching other criteria.
            This prevents unassigned leads from falling through the cracks.
          </QuickTip>
          <QuickTip title="Review Regularly" type="warning">
            When team members join or leave, update assignment rules. Leads assigned
            to inactive users won't get followed up.
          </QuickTip>
        </div>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-8">
        <Link href="/crm/learn/leads/converting">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Previous: Converting Leads
          </Button>
        </Link>
        <Link href="/crm/learn/deals">
          <Button className="gap-2">
            Next: Deals & Pipeline
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
