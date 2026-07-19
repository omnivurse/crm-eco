'use client';

import { ArrowLeft, Clock } from '@phosphor-icons/react';
import Link from 'next/link';
import { cn } from '@crm-eco/ui';
import { Button } from '@crm-eco/ui/components/button';

// ─── Article Layout ─────────────────────────────────────────────────────────

interface ArticleLayoutProps {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  readTime?: string;
  children: React.ReactNode;
}

export function ArticleLayout({
  title,
  description,
  backHref = '/learn',
  backLabel = 'Back to Learn',
  readTime,
  children,
}: ArticleLayoutProps) {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Back link */}
      <div className="mb-6">
        <Button variant="ghost" size="sm" className="gap-2 text-slate-500 hover:text-slate-700" asChild>
          <Link href={backHref}>
            <ArrowLeft weight="light" className="w-4 h-4" />
            {backLabel}
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-3">{title}</h1>
        {(description || readTime) && (
          <div className="flex items-center gap-4">
            {description && (
              <p className="text-lg text-slate-500">{description}</p>
            )}
            {readTime && (
              <span className="flex items-center gap-1 text-sm text-slate-400 whitespace-nowrap">
                <Clock weight="light" className="w-4 h-4" />
                {readTime}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="space-y-8">
        {children}
      </div>
    </div>
  );
}

// ─── Step List ──────────────────────────────────────────────────────────────

interface Step {
  title: string;
  description: string;
}

export function StepList({ steps }: { steps: Step[] }) {
  return (
    <div className="space-y-4">
      {steps.map((step, index) => (
        <div key={index} className="flex gap-4">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-[#0891b2] to-[#059669] flex items-center justify-center text-white font-semibold text-sm">
            {index + 1}
          </div>
          <div className="flex-1 pb-4 border-b border-slate-200 last:border-0">
            <h4 className="font-semibold text-slate-900 mb-1">
              {step.title}
            </h4>
            <p className="text-sm text-slate-600">
              {step.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Quick Tip ──────────────────────────────────────────────────────────────

interface QuickTipProps {
  title: string;
  children: React.ReactNode;
  type?: 'tip' | 'warning' | 'info';
}

export function QuickTip({ title, children, type = 'tip' }: QuickTipProps) {
  const styles = {
    tip: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };

  const icons = {
    tip: '💡',
    warning: '⚠️',
    info: 'ℹ️',
  };

  return (
    <div className={cn('p-4 rounded-xl border', styles[type])}>
      <div className="flex items-center gap-2 font-semibold mb-2">
        <span>{icons[type]}</span>
        {title}
      </div>
      <div className="text-sm opacity-90">
        {children}
      </div>
    </div>
  );
}

// ─── Section Card ───────────────────────────────────────────────────────────

interface SectionCardProps {
  title: string;
  children: React.ReactNode;
}

export function SectionCard({ title, children }: SectionCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <h2 className="text-xl font-bold text-slate-900 mb-4">{title}</h2>
      <div className="space-y-4 text-slate-600 text-sm leading-relaxed">
        {children}
      </div>
    </div>
  );
}
