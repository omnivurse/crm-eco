'use client';

import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import {
  ArrowLeft,
  Sparkles,
  Bug,
  Zap,
  Shield,
  Wrench,
  Star,
} from 'lucide-react';

const RELEASES = [
  {
    version: '2.5.0',
    date: 'January 2026',
    tag: 'Latest',
    changes: [
      { type: 'feature', icon: <Sparkles className="w-4 h-4" />, text: 'Email sequences with multi-step automation' },
      { type: 'feature', icon: <Sparkles className="w-4 h-4" />, text: 'Visual workflow builder with drag-and-drop' },
      { type: 'improvement', icon: <Zap className="w-4 h-4" />, text: 'Improved pipeline board performance' },
      { type: 'fix', icon: <Bug className="w-4 h-4" />, text: 'Fixed date filters in advanced search' },
    ],
  },
  {
    version: '2.4.0',
    date: 'December 2025',
    changes: [
      { type: 'feature', icon: <Sparkles className="w-4 h-4" />, text: 'Custom email domain verification' },
      { type: 'feature', icon: <Sparkles className="w-4 h-4" />, text: 'Email template library with categories' },
      { type: 'improvement', icon: <Zap className="w-4 h-4" />, text: 'Faster report generation' },
      { type: 'security', icon: <Shield className="w-4 h-4" />, text: 'Enhanced API rate limiting' },
    ],
  },
  {
    version: '2.3.0',
    date: 'November 2025',
    changes: [
      { type: 'feature', icon: <Sparkles className="w-4 h-4" />, text: 'Mass email campaigns with tracking' },
      { type: 'feature', icon: <Sparkles className="w-4 h-4" />, text: 'Campaign analytics dashboard' },
      { type: 'improvement', icon: <Zap className="w-4 h-4" />, text: 'Inline editing in list views' },
      { type: 'fix', icon: <Bug className="w-4 h-4" />, text: 'Fixed merge field rendering in emails' },
    ],
  },
  {
    version: '2.2.0',
    date: 'October 2025',
    changes: [
      { type: 'feature', icon: <Sparkles className="w-4 h-4" />, text: 'Advanced filter builder with date presets' },
      { type: 'feature', icon: <Sparkles className="w-4 h-4" />, text: 'Lead scoring rules' },
      { type: 'improvement', icon: <Zap className="w-4 h-4" />, text: 'Redesigned settings interface' },
      { type: 'maintenance', icon: <Wrench className="w-4 h-4" />, text: 'Database performance optimizations' },
    ],
  },
  {
    version: '2.1.0',
    date: 'September 2025',
    changes: [
      { type: 'feature', icon: <Sparkles className="w-4 h-4" />, text: 'Contact import from CSV with mapping' },
      { type: 'feature', icon: <Sparkles className="w-4 h-4" />, text: 'Duplicate detection and merging' },
      { type: 'improvement', icon: <Zap className="w-4 h-4" />, text: 'Improved search across all modules' },
      { type: 'fix', icon: <Bug className="w-4 h-4" />, text: 'Fixed timezone handling in reports' },
    ],
  },
  {
    version: '2.0.0',
    date: 'August 2025',
    tag: 'Major Release',
    changes: [
      { type: 'feature', icon: <Star className="w-4 h-4" />, text: 'Complete UI redesign with dark mode' },
      { type: 'feature', icon: <Sparkles className="w-4 h-4" />, text: 'Kanban pipeline board for deals' },
      { type: 'feature', icon: <Sparkles className="w-4 h-4" />, text: 'Learning Center with interactive demos' },
      { type: 'improvement', icon: <Zap className="w-4 h-4" />, text: 'Mobile-responsive design' },
      { type: 'security', icon: <Shield className="w-4 h-4" />, text: 'Two-factor authentication' },
    ],
  },
];

function getTypeColor(type: string) {
  switch (type) {
    case 'feature':
      return 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300';
    case 'improvement':
      return 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300';
    case 'fix':
      return 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300';
    case 'security':
      return 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300';
    case 'maintenance':
      return 'bg-slate-100 dark:bg-slate-500/20 text-slate-700 dark:text-slate-300';
    default:
      return 'bg-slate-100 dark:bg-slate-500/20 text-slate-700 dark:text-slate-300';
  }
}

export default function ChangelogPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/crm/learn" className="text-slate-500 hover:text-teal-600 transition-colors">
          Learning Center
        </Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-900 dark:text-white font-medium">What's New</span>
      </div>

      {/* Header */}
      <div className="text-center">
        <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500 mb-6">
          <Sparkles className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
          What's New in CRM Eco
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          See the latest features, improvements, and fixes. We're always working
          to make CRM Eco better for you.
        </p>
      </div>

      {/* Releases */}
      <div className="space-y-8">
        {RELEASES.map((release) => (
          <div
            key={release.version}
            className="relative pl-8 border-l-2 border-slate-200 dark:border-slate-700"
          >
            {/* Version Badge */}
            <div className="absolute -left-3 top-0 w-6 h-6 rounded-full bg-teal-500 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-white" />
            </div>

            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                v{release.version}
              </h2>
              <span className="text-sm text-slate-500">{release.date}</span>
              {release.tag && (
                <span className="px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 text-xs font-medium">
                  {release.tag}
                </span>
              )}
            </div>

            {/* Changes */}
            <div className="space-y-3">
              {release.changes.map((change, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 rounded-lg bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700"
                >
                  <div className={`p-1.5 rounded ${getTypeColor(change.type)}`}>
                    {change.icon}
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{change.text}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
        <h3 className="font-medium text-slate-900 dark:text-white mb-3">Change Types</h3>
        <div className="flex flex-wrap gap-4">
          {[
            { type: 'feature', label: 'New Feature', icon: <Sparkles className="w-3 h-3" /> },
            { type: 'improvement', label: 'Improvement', icon: <Zap className="w-3 h-3" /> },
            { type: 'fix', label: 'Bug Fix', icon: <Bug className="w-3 h-3" /> },
            { type: 'security', label: 'Security', icon: <Shield className="w-3 h-3" /> },
            { type: 'maintenance', label: 'Maintenance', icon: <Wrench className="w-3 h-3" /> },
          ].map((item) => (
            <div key={item.type} className="flex items-center gap-2">
              <div className={`p-1 rounded ${getTypeColor(item.type)}`}>
                {item.icon}
              </div>
              <span className="text-sm text-slate-600 dark:text-slate-400">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-center border-t border-slate-200 dark:border-slate-700 pt-8">
        <Link href="/crm/learn">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Learning Center
          </Button>
        </Link>
      </div>
    </div>
  );
}
