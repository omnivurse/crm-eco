'use client';

import { useState } from 'react';
import { Button, Badge } from '@crm-eco/ui';
import { Play, Loader2, FlaskConical } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface RunNowPanelProps {
  organizationId: string;
  currentMonth: string; // e.g. "June 2026"
  currentPeriod: string; // e.g. "2026-06"
}

export function RunNowPanel({ organizationId, currentMonth, currentPeriod }: RunNowPanelProps) {
  const [running, setRunning] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const router = useRouter();

  const handleRunNow = async () => {
    setRunning(true);
    try {
      const res = await fetch('/api/cron/commissions-accrual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organizationId,
          period: currentPeriod,
          dry_run: dryRun,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to run commission accrual');
      }

      toast.success(
        dryRun
          ? `Dry run completed — ${data.summary?.success ?? 0} orgs processed`
          : `Commission accrual completed — ${data.summary?.success ?? 0} orgs processed`
      );

      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to run commission accrual');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {/* Dry-run toggle */}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <div className="relative">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
          />
          <div className="w-9 h-5 bg-slate-200 peer-checked:bg-amber-400 rounded-full transition-colors" />
          <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
        </div>
        <span className="text-sm text-slate-600 flex items-center gap-1">
          <FlaskConical className="h-3.5 w-3.5" />
          Dry run
        </span>
      </label>

      {dryRun && (
        <Badge className="bg-amber-100 text-amber-700 text-xs">Preview only</Badge>
      )}

      <Button
        onClick={handleRunNow}
        disabled={running}
        size="sm"
      >
        {running ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Play className="h-4 w-4 mr-2" />
        )}
        Run now for {currentMonth}
      </Button>
    </div>
  );
}
