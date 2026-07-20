'use client';

import { Phone, Mail, Calendar, CheckSquare, Sparkles } from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { suggestNextBestActions } from '@/lib/crm/habits/score';
import { emitHabitSignal } from '@/lib/crm/habits/beacon';
import { parseHabitsProfile, type CrmHabitsProfile } from '@/lib/crm/habits/types';
import { useUiPreferences } from '@/hooks/useUiPreferences';

const ICONS: Record<string, typeof Phone> = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  task: CheckSquare,
};

interface HabitNextBestActionsProps {
  moduleKey?: string | null;
  stage?: string | null;
  onCall?: () => void;
  onEmail?: () => void;
  onTask?: () => void;
}

export function HabitNextBestActions({
  moduleKey,
  stage,
  onCall,
  onEmail,
  onTask,
}: HabitNextBestActionsProps) {
  const { preferences } = useUiPreferences();
  const habits =
    parseHabitsProfile(preferences.habits) ??
    (preferences.habits as CrmHabitsProfile | undefined);
  const hints = suggestNextBestActions(habits ?? null, { stage, limit: 2 });

  if (hints.length === 0) return null;

  const run = (channel: string) => {
    emitHabitSignal('nba_accepted', {
      module_key: moduleKey ?? null,
      meta: { channel },
    });
    if (channel === 'call') onCall?.();
    else if (channel === 'email') onEmail?.();
    else if (channel === 'task' || channel === 'meeting') onTask?.();
  };

  return (
    <section className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/40 p-3 space-y-2">
      <div className="flex items-center gap-1.5 px-1">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Suggested for you
        </h4>
      </div>
      <div className="space-y-1.5">
        {hints.map((hint) => {
          const Icon = ICONS[hint.channel] ?? CheckSquare;
          return (
            <Button
              key={hint.channel}
              variant="ghost"
              size="sm"
              className="w-full justify-start h-auto py-2 text-left"
              onClick={() => run(hint.channel)}
              title={hint.reason}
            >
              <Icon className="w-4 h-4 mr-2 shrink-0 text-primary" />
              <span className="flex flex-col items-start min-w-0">
                <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                  {hint.label}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-full">
                  {hint.reason}
                </span>
              </span>
            </Button>
          );
        })}
      </div>
    </section>
  );
}
