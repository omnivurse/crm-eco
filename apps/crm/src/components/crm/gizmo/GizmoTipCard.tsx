'use client';

import { memo, createElement } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  X,
  ExternalLink,
  EyeOff,
  Lightbulb,
  CheckCheck,
} from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import type { GizmoTip } from './gizmo-types';
import { resolveGizmoTipIcon } from './gizmo-tip-icon';

interface GizmoTipCardProps {
  tip: GizmoTip;
  pageLabel: string;
  currentIndex: number;
  totalCount: number;
  onDismiss: () => void;
  onDismissAll: () => void;
  onPrev: () => void;
  onNext: () => void;
  onHideGizmo: () => void;
}

export const GizmoTipCard = memo(function GizmoTipCard({
  tip,
  pageLabel,
  currentIndex,
  totalCount,
  onDismiss,
  onDismissAll,
  onPrev,
  onNext,
  onHideGizmo,
}: GizmoTipCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-500/20">
            <Lightbulb className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          </div>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Gizmo &mdash; {pageLabel}
          </span>
        </div>
        <button
          onClick={onDismiss}
          className="flex items-center justify-center w-6 h-6 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Dismiss this tip"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tip content */}
      <div className="px-4 pb-3">
        <div className="flex gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-500/15 border border-teal-100/80 dark:border-teal-500/20"
            aria-hidden
          >
            {createElement(resolveGizmoTipIcon(tip.icon), {
              className: 'h-4 w-4 text-teal-600 dark:text-teal-400',
              'aria-hidden': true,
            })}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{tip.title}</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {tip.body}
            </p>

            {tip.learnMoreHref && (
              <Link
                href={tip.learnMoreHref}
                className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors"
              >
                Learn more <ExternalLink className="w-3 h-3" aria-hidden />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Footer: navigation + actions */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900/50">
        {/* Step navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={onPrev}
            disabled={currentIndex === 0}
            className={cn(
              'flex items-center justify-center w-6 h-6 rounded-md transition-colors',
              currentIndex === 0
                ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            )}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400 min-w-[3rem] text-center">
            {currentIndex + 1} / {totalCount}
          </span>

          <button
            onClick={onNext}
            disabled={currentIndex === totalCount - 1}
            className={cn(
              'flex items-center justify-center w-6 h-6 rounded-md transition-colors',
              currentIndex === totalCount - 1
                ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            )}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={onDismissAll}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            title="Dismiss all tips on this page"
          >
            <CheckCheck className="w-3 h-3" />
            Got it
          </button>
          <button
            onClick={onHideGizmo}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            title="Hide Gizmo entirely"
          >
            <EyeOff className="w-3 h-3" />
            Hide
          </button>
        </div>
      </div>
    </motion.div>
  );
});
