'use client';

import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import {
  ArrowLeft,
  ArrowRight,
  TestTube,
  Clock,
  CheckCircle,
  Play,
  AlertTriangle,
  Bug,
  Eye,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { AnimatedDemo, StepList, QuickTip } from '@/components/learn/AnimatedDemo';

const DEMO_STEPS = [
  {
    title: 'Open Your Workflow',
    description: 'Navigate to the workflow you want to test.',
    cursor: { x: 50, y: 35 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Click Test Mode',
    description: 'Click the "Test" button to enter test mode.',
    highlight: { x: 65, y: 12, width: 12, height: 5 },
    cursor: { x: 71, y: 14 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Select Test Record',
    description: 'Choose a sample record to test with.',
    highlight: { x: 25, y: 30, width: 50, height: 20 },
    cursor: { x: 50, y: 40 },
    action: 'click' as const,
    duration: 3000,
  },
  {
    title: 'Run Test',
    description: 'Click "Run Test" to simulate the workflow.',
    highlight: { x: 65, y: 55, width: 15, height: 5 },
    cursor: { x: 72, y: 57 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Review Results',
    description: 'See what would happen without actually executing.',
    highlight: { x: 20, y: 62, width: 60, height: 25 },
    cursor: { x: 50, y: 74 },
    duration: 3500,
  },
];

export default function TestingPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/crm/learn" className="text-slate-500 hover:text-teal-600 transition-colors">
          Learning Center
        </Link>
        <span className="text-slate-400">/</span>
        <Link href="/crm/learn/workflows" className="text-slate-500 hover:text-teal-600 transition-colors">
          Workflows
        </Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-900 dark:text-white font-medium">Testing Workflows</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500">
          <TestTube className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Testing Workflows
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Validate your workflows before going live with test mode and logs.
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
          title="Testing a Workflow"
          steps={DEMO_STEPS}
        />
      </section>

      {/* Why Test */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Why Testing Matters
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Workflows affect real data automatically. Testing ensures your automation
          does exactly what you intend before it touches production records.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { icon: <Bug className="w-5 h-5" />, title: 'Catch Errors', description: 'Find configuration mistakes early' },
            { icon: <Eye className="w-5 h-5" />, title: 'Preview Results', description: 'See what would happen without risk' },
            { icon: <CheckCircle className="w-5 h-5" />, title: 'Validate Logic', description: 'Ensure conditions work correctly' },
            { icon: <RefreshCw className="w-5 h-5" />, title: 'Iterate Safely', description: 'Refine workflows before going live' },
          ].map((benefit) => (
            <div
              key={benefit.title}
              className="flex items-start gap-3 p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700"
            >
              <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400">
                {benefit.icon}
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">{benefit.title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">{benefit.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Test Mode Features */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Test Mode Features
        </h2>
        <div className="grid gap-4">
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <Play className="w-5 h-5 text-emerald-500" />
              <h3 className="font-semibold text-slate-900 dark:text-white">Dry Run</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Simulates the entire workflow without making any changes. Shows what
              would happen step by step.
            </p>
          </div>
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="w-5 h-5 text-blue-500" />
              <h3 className="font-semibold text-slate-900 dark:text-white">Execution Log</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Detailed log of every workflow run: when it triggered, conditions checked,
              actions taken, and any errors.
            </p>
          </div>
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h3 className="font-semibold text-slate-900 dark:text-white">Error Details</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              When something goes wrong, see exactly why. Error messages show which
              step failed and how to fix it.
            </p>
          </div>
        </div>
      </section>

      {/* Step by Step */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          How to Test
        </h2>
        <StepList
          steps={[
            {
              title: 'Open Your Workflow',
              description: 'Navigate to the workflow in Settings → Automations → Workflows.',
            },
            {
              title: 'Enter Test Mode',
              description: 'Click the "Test" button in the workflow editor.',
            },
            {
              title: 'Select a Test Record',
              description: 'Choose a sample record that matches your trigger conditions.',
            },
            {
              title: 'Run the Test',
              description: 'Click "Run Test" to simulate execution.',
            },
            {
              title: 'Review Each Step',
              description: 'See which conditions passed/failed and what actions would run.',
            },
            {
              title: 'Fix Issues',
              description: 'If something\'s wrong, adjust the workflow and test again.',
            },
            {
              title: 'Activate When Ready',
              description: 'Once testing passes, toggle the workflow active.',
            },
          ]}
        />
      </section>

      {/* Tips */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Testing Best Practices
        </h2>
        <div className="space-y-4">
          <QuickTip title="Test Multiple Scenarios" type="tip">
            Don't just test the happy path. Test records that should NOT trigger
            the workflow to ensure your conditions filter correctly.
          </QuickTip>
          <QuickTip title="Use Test Data" type="info">
            Create test contacts with obvious names (e.g., "Test Contact - Delete Me")
            so you don't accidentally affect real customer data.
          </QuickTip>
          <QuickTip title="Monitor After Activation" type="warning">
            Even after testing, keep an eye on the execution log for the first few
            days. Real data may have edge cases your tests didn't cover.
          </QuickTip>
        </div>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-8">
        <Link href="/crm/learn/workflows/triggers">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Previous: Triggers & Actions
          </Button>
        </Link>
        <Link href="/crm/learn/reports">
          <Button className="gap-2">
            Next: Reports & Analytics
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
