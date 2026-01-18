'use client';

import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import {
  ArrowLeft,
  ArrowRight,
  Star,
  Clock,
  CheckCircle,
  Plus,
  Minus,
  TrendingUp,
  Target,
  Award,
  Settings,
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
    title: 'Select Lead Scoring',
    description: 'Click on "Lead Scoring" under the Leads section.',
    cursor: { x: 15, y: 40 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Add Scoring Rule',
    description: 'Click "Add Rule" to create a new scoring criterion.',
    highlight: { x: 70, y: 20, width: 15, height: 5 },
    cursor: { x: 77, y: 22 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Configure Rule',
    description: 'Set the condition and point value for this scoring rule.',
    highlight: { x: 20, y: 30, width: 60, height: 35 },
    cursor: { x: 50, y: 47 },
    duration: 3500,
  },
  {
    title: 'View Lead Scores',
    description: 'Go to Leads and see scores displayed on each record.',
    highlight: { x: 75, y: 30, width: 15, height: 40 },
    cursor: { x: 82, y: 50 },
    duration: 3000,
  },
];

const SCORING_EXAMPLES = [
  { criterion: 'Company size > 100 employees', points: '+15', type: 'positive' },
  { criterion: 'Opened email in last 7 days', points: '+10', type: 'positive' },
  { criterion: 'Visited pricing page', points: '+20', type: 'positive' },
  { criterion: 'Downloaded whitepaper', points: '+15', type: 'positive' },
  { criterion: 'Job title is "Manager" or above', points: '+10', type: 'positive' },
  { criterion: 'No activity in 30 days', points: '-20', type: 'negative' },
  { criterion: 'Personal email domain', points: '-10', type: 'negative' },
];

export default function ScoringPage() {
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
        <span className="text-slate-900 dark:text-white font-medium">Lead Scoring</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500">
          <Star className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Lead Scoring
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Automatically prioritize leads based on criteria that predict conversion.
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
          Interactive Demo
        </h2>
        <AnimatedDemo
          title="Setting Up Lead Scoring"
          steps={DEMO_STEPS}
        />
      </section>

      {/* What is Lead Scoring */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          What is Lead Scoring?
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Lead scoring assigns point values to leads based on their attributes and behaviors.
          Higher scores indicate leads more likely to convert, helping your team prioritize
          their time effectively.
        </p>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { icon: <Target className="w-5 h-5" />, title: 'Prioritize', description: 'Focus on high-potential leads' },
            { icon: <TrendingUp className="w-5 h-5" />, title: 'Predict', description: 'Identify likely converters' },
            { icon: <Award className="w-5 h-5" />, title: 'Qualify', description: 'Automate qualification process' },
          ].map((feature) => (
            <div
              key={feature.title}
              className="flex flex-col items-center text-center p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700"
            >
              <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 mb-3">
                {feature.icon}
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white">{feature.title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Example Scoring Rules */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Example Scoring Rules
        </h2>
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          {SCORING_EXAMPLES.map((rule, index) => (
            <div
              key={rule.criterion}
              className={`flex items-center justify-between p-4 ${index < SCORING_EXAMPLES.length - 1 ? 'border-b border-slate-200 dark:border-slate-700' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-1 rounded ${rule.type === 'positive' ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-red-100 dark:bg-red-500/20'}`}>
                  {rule.type === 'positive' ? (
                    <Plus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Minus className="w-4 h-4 text-red-600 dark:text-red-400" />
                  )}
                </div>
                <span className="text-slate-700 dark:text-slate-300">{rule.criterion}</span>
              </div>
              <span className={`font-semibold ${rule.type === 'positive' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {rule.points}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Step by Step */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Setting Up Lead Scoring
        </h2>
        <StepList
          steps={[
            {
              title: 'Access Scoring Settings',
              description: 'Go to Settings → Leads → Lead Scoring.',
            },
            {
              title: 'Define Demographic Rules',
              description: 'Add rules based on lead attributes (company size, industry, job title).',
            },
            {
              title: 'Add Behavioral Rules',
              description: 'Score leads based on actions (email opens, page visits, form submissions).',
            },
            {
              title: 'Include Negative Scoring',
              description: 'Deduct points for disqualifying factors (inactivity, wrong industry).',
            },
            {
              title: 'Set Score Thresholds',
              description: 'Define what scores indicate a "Hot", "Warm", or "Cold" lead.',
            },
            {
              title: 'Test and Refine',
              description: 'Review scored leads and adjust rules based on actual conversion data.',
            },
          ]}
        />
      </section>

      {/* Score Ranges */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Score Interpretation
        </h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-center">
            <div className="text-3xl font-bold text-red-600 dark:text-red-400 mb-1">0-30</div>
            <div className="text-sm font-medium text-red-700 dark:text-red-300">Cold Lead</div>
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">Needs nurturing</p>
          </div>
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-center">
            <div className="text-3xl font-bold text-amber-600 dark:text-amber-400 mb-1">31-70</div>
            <div className="text-sm font-medium text-amber-700 dark:text-amber-300">Warm Lead</div>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Continue engagement</p>
          </div>
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-center">
            <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mb-1">71+</div>
            <div className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Hot Lead</div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Ready to contact</p>
          </div>
        </div>
      </section>

      {/* Tips */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Scoring Best Practices
        </h2>
        <div className="space-y-4">
          <QuickTip title="Start Simple" type="tip">
            Begin with 5-10 rules based on your most predictive criteria.
            Add complexity over time as you learn what works.
          </QuickTip>
          <QuickTip title="Use Data to Guide Rules" type="info">
            Analyze your converted leads. What attributes did they share?
            What actions did they take before converting?
          </QuickTip>
          <QuickTip title="Review Regularly" type="warning">
            Revisit your scoring model quarterly. Market conditions and
            buyer behavior change over time.
          </QuickTip>
        </div>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-8">
        <Link href="/crm/learn/leads/overview">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Previous: Understanding Leads
          </Button>
        </Link>
        <Link href="/crm/learn/leads/converting">
          <Button className="gap-2">
            Next: Converting Leads
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
