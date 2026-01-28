'use client';

import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  Clock,
  CheckCircle,
  Type,
  Image as ImageIcon,
  Link2,
  Variable,
  Palette,
  Copy,
  Settings,
} from 'lucide-react';
import { AnimatedDemo, StepList, QuickTip } from '@/components/learn/AnimatedDemo';

const DEMO_STEPS = [
  {
    title: 'Go to Templates',
    description: 'Navigate to Settings → Email Templates.',
    cursor: { x: 15, y: 38 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Create New Template',
    description: 'Click "Create Template" to start building.',
    highlight: { x: 70, y: 15, width: 18, height: 5 },
    cursor: { x: 79, y: 17 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Enter Subject Line',
    description: 'Write a compelling subject line for your email.',
    highlight: { x: 15, y: 25, width: 70, height: 8 },
    cursor: { x: 50, y: 29 },
    action: 'click' as const,
    duration: 2500,
  },
  {
    title: 'Compose Email Body',
    description: 'Use the editor to write your email content.',
    highlight: { x: 15, y: 35, width: 70, height: 40 },
    cursor: { x: 50, y: 55 },
    action: 'click' as const,
    duration: 3500,
  },
  {
    title: 'Insert Merge Fields',
    description: 'Click to insert personalization like {{first_name}}.',
    highlight: { x: 15, y: 78, width: 25, height: 5 },
    cursor: { x: 27, y: 80 },
    action: 'click' as const,
    duration: 3000,
  },
  {
    title: 'Save Template',
    description: 'Click "Save" to store your template for reuse.',
    highlight: { x: 70, y: 85, width: 15, height: 5 },
    cursor: { x: 77, y: 87 },
    action: 'click' as const,
    duration: 2500,
  },
];

const MERGE_FIELDS = [
  { field: '{{first_name}}', description: 'Recipient first name' },
  { field: '{{last_name}}', description: 'Recipient last name' },
  { field: '{{email}}', description: 'Recipient email address' },
  { field: '{{company}}', description: 'Company name' },
  { field: '{{title}}', description: 'Job title' },
  { field: '{{owner.name}}', description: 'Assigned rep name' },
];

export default function TemplatesPage() {
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
        <span className="text-slate-900 dark:text-white font-medium">Email Templates</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0 p-4 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500">
          <FileText className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Email Templates
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Create reusable email templates with personalization and rich formatting.
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
          title="Creating an Email Template"
          steps={DEMO_STEPS}
        />
      </section>

      {/* Template Features */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Template Capabilities
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { icon: <Type className="w-5 h-5" />, title: 'Rich Text Editing', description: 'Bold, italic, lists, and text formatting' },
            { icon: <ImageIcon className="w-5 h-5" />, title: 'Images', description: 'Insert images with alt text and sizing' },
            { icon: <Link2 className="w-5 h-5" />, title: 'Links', description: 'Add clickable links with tracking' },
            { icon: <Variable className="w-5 h-5" />, title: 'Merge Fields', description: 'Personalize with contact data' },
            { icon: <Palette className="w-5 h-5" />, title: 'Styling', description: 'Colors, fonts, and alignment' },
            { icon: <Copy className="w-5 h-5" />, title: 'Clone', description: 'Duplicate templates to create variants' },
          ].map((feature) => (
            <div
              key={feature.title}
              className="flex items-start gap-3 p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700"
            >
              <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400">
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

      {/* Merge Fields */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Common Merge Fields
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Merge fields are replaced with actual data when the email is sent:
        </p>
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="grid grid-cols-2 gap-4 p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <div className="text-sm font-medium text-slate-500 uppercase tracking-wider">Field</div>
            <div className="text-sm font-medium text-slate-500 uppercase tracking-wider">Description</div>
          </div>
          {MERGE_FIELDS.map((item) => (
            <div key={item.field} className="grid grid-cols-2 gap-4 p-4 border-b last:border-b-0 border-slate-200 dark:border-slate-700">
              <code className="text-sm text-teal-600 dark:text-teal-400">{item.field}</code>
              <span className="text-sm text-slate-600 dark:text-slate-400">{item.description}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Step by Step */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Creating a Template
        </h2>
        <StepList
          steps={[
            {
              title: 'Go to Templates',
              description: 'Navigate to Settings → Email Templates.',
            },
            {
              title: 'Choose Category',
              description: 'Select a category (Sales, Marketing, Support) for organization.',
            },
            {
              title: 'Write Subject Line',
              description: 'Create a compelling subject. Use merge fields for personalization.',
            },
            {
              title: 'Compose Body',
              description: 'Write your email using the rich text editor. Keep it scannable.',
            },
            {
              title: 'Add Personalization',
              description: 'Insert merge fields where you want dynamic content.',
            },
            {
              title: 'Preview and Save',
              description: 'Preview with sample data, then save your template.',
            },
          ]}
        />
      </section>

      {/* Tips */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Template Best Practices
        </h2>
        <div className="space-y-4">
          <QuickTip title="Keep It Simple" type="tip">
            Simple, text-focused emails often perform better than heavily designed ones.
            They feel more personal and load faster.
          </QuickTip>
          <QuickTip title="Handle Missing Data" type="info">
            Merge fields with missing data show as blank. Use fallbacks or conditional
            content to handle cases where data might be missing.
          </QuickTip>
          <QuickTip title="Test Before Sending" type="warning">
            Always send a test email to yourself. Check that merge fields populate
            correctly and links work before sending to your list.
          </QuickTip>
        </div>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-8">
        <Link href="/crm/learn/campaigns/recipients">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Previous: Selecting Recipients
          </Button>
        </Link>
        <Link href="/crm/learn/campaigns/analytics">
          <Button className="gap-2">
            Next: Tracking & Analytics
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
