'use client';

import { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, EyeOff } from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@crm-eco/ui/components/popover';
import { useGizmo } from './GizmoProvider';
import { GizmoTipCard } from './GizmoTipCard';

export const GizmoWidget = memo(function GizmoWidget() {
  const {
    enabled,
    setEnabled,
    currentTips,
    allCurrentTips,
    currentPageLabel,
    dismissTip,
    dismissAllCurrentTips,
    hasNewTips,
    isOpen,
    setIsOpen,
  } = useGizmo();

  const [activeIndex, setActiveIndex] = useState(0);

  // Don't render if Gizmo is disabled or no tips exist for this page
  if (!enabled || allCurrentTips.length === 0) return null;

  const activeTip = currentTips[activeIndex] ?? currentTips[0];
  const totalUndismissed = currentTips.length;

  return (
    <div className="fixed bottom-14 right-4 z-30 lg:bottom-14 lg:right-6">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 1 }}
            className={cn(
              'relative flex items-center justify-center w-10 h-10 rounded-full shadow-lg transition-colors',
              'bg-teal-600 hover:bg-teal-700 text-white',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2'
            )}
            title={hasNewTips ? `Gizmo has ${totalUndismissed} tips for this page` : 'Gizmo tips'}
          >
            <Lightbulb className="w-5 h-5" />

            {/* Badge */}
            {hasNewTips && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-amber-900">
                {totalUndismissed}
              </span>
            )}
          </motion.button>
        </PopoverTrigger>

        <PopoverContent
          side="top"
          align="end"
          sideOffset={12}
          className="w-80 lg:w-96 p-0 overflow-hidden rounded-xl"
        >
          <AnimatePresence mode="wait">
            {totalUndismissed > 0 && activeTip ? (
              <GizmoTipCard
                key={activeTip.id}
                tip={activeTip}
                pageLabel={currentPageLabel ?? 'This page'}
                currentIndex={activeIndex}
                totalCount={totalUndismissed}
                onDismiss={() => {
                  dismissTip(activeTip.id);
                  if (activeIndex >= totalUndismissed - 1) {
                    setActiveIndex(Math.max(0, activeIndex - 1));
                  }
                }}
                onDismissAll={() => {
                  dismissAllCurrentTips();
                  setIsOpen(false);
                }}
                onPrev={() => setActiveIndex((i) => Math.max(0, i - 1))}
                onNext={() => setActiveIndex((i) => Math.min(totalUndismissed - 1, i + 1))}
                onHideGizmo={() => {
                  setEnabled(false);
                  setIsOpen(false);
                }}
              />
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="p-5 text-center"
              >
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  You&apos;re all caught up on this page!
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Gizmo will let you know when there are new tips.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </PopoverContent>
      </Popover>
    </div>
  );
});
