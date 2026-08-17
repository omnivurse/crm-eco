'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@crm-eco/ui/components/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@crm-eco/ui/components/alert-dialog';
import { UserCheck, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { getConvertActionLabel, getMemberNoun, getMemberNounTitle } from '@/lib/crm/member-terminology';

interface ConvertLeadButtonProps {
  recordId: string;
  recordTitle: string;
  disabled?: boolean;
  /** Drives Member vs Insurance-Client terminology (display only). */
  marketType?: string | null;
  /**
   * ISO date (YYYY-MM-DD) when coverage starts. When in the future, the dialog
   * steers reps toward Convert to Contact (Pending) instead of enrollment.
   */
  effectiveStartDate?: string | null;
  /** When true, show Contact-vs-enrollment guidance (lead records). */
  showContactAlternative?: boolean;
  /** Match sibling header actions (default sm in record headers). */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /**
   * Controlled open state for the confirm dialog. Lets a parent menu (e.g.
   * the record header's Convert… dropdown) open the SAME dialog without
   * rendering this component's own trigger button.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Hide the built-in trigger (use with `open` / `onOpenChange`). */
  hideTrigger?: boolean;
}

function isFutureDate(isoDate?: string | null): boolean {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}/.test(isoDate)) return false;
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  const startUtc = Date.UTC(y, (m ?? 1) - 1, d ?? 1);
  return startUtc > todayUtc;
}

export function ConvertLeadButton({
  recordId,
  recordTitle,
  disabled,
  marketType,
  effectiveStartDate,
  showContactAlternative = true,
  size = 'sm',
  open,
  onOpenChange,
  hideTrigger = false,
}: ConvertLeadButtonProps) {
  const convertLabel = getConvertActionLabel(marketType);
  const noun = getMemberNoun(marketType);
  const nounTitle = getMemberNounTitle(marketType);
  const futureStart = isFutureDate(effectiveStartDate);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = open !== undefined;
  const showConfirm = isControlled ? open : uncontrolledOpen;
  const setShowConfirm = (next: boolean) => {
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const [isConverting, setIsConverting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; memberId?: string } | null>(null);
  const router = useRouter();

  const handleConvert = async () => {
    setIsConverting(true);
    setResult(null);

    try {
      const response = await fetch('/api/crm/leads/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId }),
      });

      const data = await response.json();

      if (data.success) {
        setResult({
          success: true,
          message: `Lead converted to ${noun} successfully!`,
          memberId: data.member_id,
        });
        // Refresh the page after a short delay
        setTimeout(() => {
          router.refresh();
        }, 1500);
      } else {
        setResult({
          success: false,
          message: data.error || 'Failed to convert lead',
        });
      }
    } catch {
      setResult({
        success: false,
        message: 'An error occurred during conversion',
      });
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <>
      {!hideTrigger && (
        <Button
          size={size}
          onClick={() => setShowConfirm(true)}
          disabled={disabled || isConverting}
          className="inline-flex shrink-0 bg-brand-accent text-white shadow-sm hover:opacity-95"
        >
          <UserCheck className="w-4 h-4 shrink-0 sm:mr-1.5" />
          <span className="text-xs font-medium sm:text-sm">{convertLabel}</span>
        </Button>
      )}

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
          {!result ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-slate-900 dark:text-white">
                  Enroll {recordTitle} as {nounTitle}?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-slate-500 space-y-2">
                  <span className="block">
                    This enrolls <strong>{recordTitle}</strong> in the member system as a{' '}
                    <strong>{noun}</strong> and marks this lead as converted.
                  </span>
                  {showContactAlternative && (
                    <span className="block text-xs text-amber-700 dark:text-amber-400/90">
                      {futureStart
                        ? `Coverage starts ${effectiveStartDate}. Only want them in Contacts as Pending until then? Use Add as Contact instead.`
                        : 'Only want them in Contacts (no enrollment)? Use Add as Contact instead.'}
                    </span>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel
                  disabled={isConverting}
                  className="border-slate-200 dark:border-white/10"
                >
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleConvert}
                  disabled={isConverting}
                  className="bg-brand-accent text-white hover:opacity-95"
                >
                  {isConverting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Converting...
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4 mr-2" />
                      Convert
                    </>
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <div className="flex flex-col items-center text-center py-4">
                  {result.success ? (
                    <>
                      <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                        <CheckCircle className="w-8 h-8 text-emerald-500" />
                      </div>
                      <AlertDialogTitle className="text-slate-900 dark:text-white">
                        Conversion Successful!
                      </AlertDialogTitle>
                      <AlertDialogDescription className="text-slate-500 mt-2">
                        {result.message}
                      </AlertDialogDescription>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                        <AlertCircle className="w-8 h-8 text-red-500" />
                      </div>
                      <AlertDialogTitle className="text-slate-900 dark:text-white">
                        Conversion Failed
                      </AlertDialogTitle>
                      <AlertDialogDescription className="text-slate-500 mt-2">
                        {result.message}
                      </AlertDialogDescription>
                    </>
                  )}
                </div>
              </AlertDialogHeader>
              <AlertDialogFooter className="justify-center">
                <AlertDialogCancel
                  onClick={() => {
                    setResult(null);
                    setShowConfirm(false);
                  }}
                  className="border-slate-200 dark:border-white/10"
                >
                  Close
                </AlertDialogCancel>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
