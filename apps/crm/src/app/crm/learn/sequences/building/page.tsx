'use client';

import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import {
  ArrowLeft,
  ArrowRight,
  Wrench,
  Clock,
  CheckCircle,
  Mail,
  Timer,
  Plus,
  Trash2,
  Settings,
  Play,
} from 'lucide-react';
import { AnimatedDemo, StepList, QuickTip } from '@/components/learn/AnimatedDemo';

const DEMO_STEPS = [
  {
    title: 'Click Create Sequence',
    description: 'Go to Sequences and click "Create Sequence".',
    cursor: { x: 82, y: 15 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Name Your Sequence',
    description: 'Enter a descriptive name for your sequence.',
    highlight: { x: 25, y: 25, width: 50, height: 10 },
    cursor: { x: 50, y: 30 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Add First Email',
    description: 'Click "Add Step" and choose "Email" to add your first email.',
    highlight: { x: 25, y: 40, width: 50, height: 10 },
    cursor: { x: 50, y: 45 },
    action: 'click' as const,
    duration: 3000,
  },
  {
    title: 'Compose Email',
    description: 'Write your subject and email body with merge fields.',
    highlight: { x: 20, y: 30, width: 60, height: 45 },
    cursor: { x: 50, y: 52 },
    duration: 3500,
  },
  {
    title: 'Add Wait Step',
    description: 'Add a delay between emails (e.g., "Wait 3 days").',
    highlight: { x: 25, y: 58, width: 30, height: 8 },
    cursor: { x: 40, y: 62 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Add More Steps',
    description: 'Continue adding emails and waits to build your sequence.',
    highlight: { x: 25, y: 68, width: 50, height: 15 },
    cursor: { x: 50, y: 75 },
    duration: 3000,
  },
  {
    title: 'Activate Sequence',
    description: 'Click "Activate" when ready to start enrolling contacts.',
    highlight: { x: 75, y: 15, width: 15, height: 5 },
    cursor: { x: 82, y: 17 },
    action: 'click' as const,
    duration: 2500,
  },
];

export default function BuildingSequencePage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/crm/learn" className="text-slate-500 hover:text-teal-600 transition-colors">
          Learning Center
        </Link>
        <span className="text-slate-400">/</span>
        <Link href="/crm/learn/sequences" className="text-slate-500 hover:text-teal-600 transition-colors">
          Sequences
        </Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-900 dark:text-white font-medium">Building a Sequence</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500">
          <Wrench className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Building a Sequence
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Create multi-step email sequences with this step-by-step guide.
          </p>
          <div className="flex items-center gap-4 mt-4 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              6 min read
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
          title="Building Your First Sequence"
          steps={DEMO_STEPS}
        />
      </section>

      {/* Step Types */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Available Step Types
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                <Mail className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Email</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
              Send an automated email. Compose subject and body with merge fields.
            </p>
            <ul className="text-xs text-slate-500 space-y-1">
              <li>• Subject line with personalization</li>
              <li>• Rich text email body</li>
              <li>• Track opens and clicks</li>
            </ul>
          </div>
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <Timer className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Wait</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
              Pause before the next step. Give recipients time to respond.
            </p>
            <ul className="text-xs text-slate-500 space-y-1">
              <li>• Set days, hours, or minutes</li>
              <li>• Business days option</li>
              <li>• Minimum wait of 1 hour</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Step by Step */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Building Your Sequence
        </h2>
        <StepList
          steps={[
            {
              title: 'Create New Sequence',
              description: 'Go to Sequences → Create Sequence. Give it a descriptive name.',
            },
            {
              title: 'Set General Settings',
              description: 'Choose sending email, timezone, and business hours if applicable.',
            },
            {
              title: 'Add Your First Email',
              description: 'Click "Add Step" → "Email". Write subject and body.',
            },
            {
              title: 'Add Wait Between Emails',
              description: 'Click "Add Step" → "Wait". Set delay (e.g., 3 days).',
            },
            {
              title: 'Continue Building',
              description: 'Alternate email and wait steps until your sequence is complete.',
            },
            {
              title: 'Configure Exit Conditions',
              description: 'Set up rules for when contacts should exit (reply, meeting booked).',
            },
            {
              title: 'Review and Activate',
              description: 'Preview the full sequence, then click "Activate".',
            },
          ]}
        />
      </section>

      {/* Email Writing Tips */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Writing Effective Sequence Emails
        </h2>
        <div className="grid gap-4">
          <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Email 1: The Introduction</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Keep it short. Introduce yourself, reference how you found them, and offer
              value. End with a soft CTA (question, not hard ask).
            </p>
          </div>
          <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Email 2-3: Value Add</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Share something useful: case study, tip, resource, or insight. Show expertise
              without being salesy. Build trust.
            </p>
          </div>
          <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Final Email: Clear Ask</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Acknowledge this is your last follow-up. Make a clear, simple ask.
              Make it easy to say yes or no.
            </p>
          </div>
        </div>
      </section>

      {/* Tips */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Building Best Practices
        </h2>
        <div className="space-y-4">
          <QuickTip title="Keep Emails Short" type="tip">
            Sequence emails should be concise—3-5 sentences max. People are more
            likely to read and respond to shorter messages.
          </QuickTip>
          <QuickTip title="Vary Your Approach" type="info">
            Don't send the same type of email repeatedly. Mix introductions,
            value content, social proof, and direct asks.
          </QuickTip>
          <QuickTip title="Test Before Going Live" type="warning">
            Enroll yourself or a colleague first. Check that timing, content,
            and merge fields all work correctly.
          </QuickTip>
        </div>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-8">
        <Link href="/crm/learn/sequences/overview">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Previous: What are Sequences?
          </Button>
        </Link>
        <Link href="/crm/learn/sequences/enrolling">
          <Button className="gap-2">
            Next: Enrolling Contacts
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
