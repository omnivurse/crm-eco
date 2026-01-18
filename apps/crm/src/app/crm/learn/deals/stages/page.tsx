'use client';

import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import {
  ArrowLeft,
  ArrowRight,
  Settings,
  Clock,
  CheckCircle,
  Plus,
  Trash2,
  GripVertical,
  Edit2,
  Percent,
} from 'lucide-react';
import { AnimatedDemo, StepList, QuickTip } from '@/components/learn/AnimatedDemo';

const DEMO_STEPS = [
  {
    title: 'Go to Settings',
    description: 'Click your profile icon and select "Settings" from the dropdown.',
    cursor: { x: 92, y: 5 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Navigate to Deals',
    description: 'In the Settings sidebar, click on "Deals" under the Modules section.',
    cursor: { x: 15, y: 35 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Click Pipeline Stages',
    description: 'Select "Pipeline Stages" to view and edit your deal stages.',
    highlight: { x: 20, y: 40, width: 60, height: 50 },
    cursor: { x: 50, y: 65 },
    action: 'click' as const,
    duration: 3000,
  },
  {
    title: 'Reorder Stages',
    description: 'Drag the grip handle to reorder stages in your pipeline.',
    highlight: { x: 25, y: 35, width: 50, height: 8 },
    cursor: { x: 28, y: 39 },
    action: 'click' as const,
    duration: 3000,
  },
  {
    title: 'Edit Stage Details',
    description: 'Click the edit icon to change stage name or probability.',
    highlight: { x: 70, y: 35, width: 8, height: 8 },
    cursor: { x: 74, y: 39 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Add New Stage',
    description: 'Click "Add Stage" to create a new stage in your pipeline.',
    highlight: { x: 25, y: 75, width: 20, height: 8 },
    cursor: { x: 35, y: 79 },
    action: 'click' as const,
    duration: 2500,
  },
];

export default function StagesPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/crm/learn" className="text-slate-500 hover:text-teal-600 transition-colors">
          Learning Center
        </Link>
        <span className="text-slate-400">/</span>
        <Link href="/crm/learn/deals" className="text-slate-500 hover:text-teal-600 transition-colors">
          Deals
        </Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-900 dark:text-white font-medium">Managing Deal Stages</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500">
          <Settings className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Managing Deal Stages
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Customize your pipeline stages to match your unique sales process.
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
          title="Customizing Pipeline Stages"
          steps={DEMO_STEPS}
        />
      </section>

      {/* Why Customize */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Why Customize Stages?
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Every business has a unique sales process. Customizing your pipeline stages ensures:
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { icon: <CheckCircle className="w-5 h-5" />, title: 'Accurate Tracking', description: 'Stages reflect your actual sales milestones' },
            { icon: <Percent className="w-5 h-5" />, title: 'Better Forecasting', description: 'Probability settings match your conversion rates' },
            { icon: <GripVertical className="w-5 h-5" />, title: 'Team Alignment', description: 'Everyone knows exactly when to move deals' },
            { icon: <Settings className="w-5 h-5" />, title: 'Cleaner Reports', description: 'Reports show data that matters to your business' },
          ].map((feature) => (
            <div
              key={feature.title}
              className="flex items-start gap-3 p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700"
            >
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400">
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

      {/* Step by Step */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Step-by-Step Instructions
        </h2>
        <StepList
          steps={[
            {
              title: 'Access Pipeline Settings',
              description: 'Go to Settings → Modules → Deals → Pipeline Stages.',
            },
            {
              title: 'Add a New Stage',
              description: 'Click "Add Stage" and enter a name and probability percentage.',
            },
            {
              title: 'Edit Existing Stages',
              description: 'Click the edit icon next to any stage to rename it or adjust the probability.',
            },
            {
              title: 'Reorder Stages',
              description: 'Drag stages using the grip handle to change their order in the pipeline.',
            },
            {
              title: 'Delete Unwanted Stages',
              description: 'Click the delete icon to remove a stage. Deals in that stage must be moved first.',
            },
            {
              title: 'Save Changes',
              description: 'Changes are saved automatically. New pipeline order applies immediately.',
            },
          ]}
        />
      </section>

      {/* Stage Properties */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Stage Properties
        </h2>
        <div className="grid gap-4">
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <Edit2 className="w-5 h-5 text-blue-500" />
              <h3 className="font-semibold text-slate-900 dark:text-white">Stage Name</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              A descriptive name that represents this point in your sales process.
              Examples: "Initial Contact", "Demo Scheduled", "Contract Sent".
            </p>
          </div>
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <Percent className="w-5 h-5 text-emerald-500" />
              <h3 className="font-semibold text-slate-900 dark:text-white">Probability (%)</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              The likelihood of closing a deal at this stage. Used for weighted forecasting.
              Higher percentages for later stages. "Closed Won" should be 100%, "Closed Lost" 0%.
            </p>
          </div>
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <GripVertical className="w-5 h-5 text-violet-500" />
              <h3 className="font-semibold text-slate-900 dark:text-white">Stage Order</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              The position in the pipeline. Deals typically progress left to right.
              The order affects how the board and reports display.
            </p>
          </div>
        </div>
      </section>

      {/* Tips */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Best Practices
        </h2>
        <div className="space-y-4">
          <QuickTip title="Keep It Simple" type="tip">
            5-7 stages is ideal. Too many stages creates confusion and extra clicks.
            Too few doesn't give enough visibility into where deals are.
          </QuickTip>
          <QuickTip title="Define Clear Criteria" type="info">
            Document what must happen before a deal can move to the next stage.
            Share this with your team for consistency.
          </QuickTip>
          <QuickTip title="Moving Deals When Changing Stages" type="warning">
            If you delete a stage that has deals, you'll need to move those deals first.
            The system will prompt you to select a new stage for them.
          </QuickTip>
        </div>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-8">
        <Link href="/crm/learn/deals/creating">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Previous: Creating Deals
          </Button>
        </Link>
        <Link href="/crm/learn/deals/forecasting">
          <Button className="gap-2">
            Next: Forecasting Sales
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
