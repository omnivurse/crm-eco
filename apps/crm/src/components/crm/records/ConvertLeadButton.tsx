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
import { getConvertActionLabel, getMemberNoun } from '@/lib/crm/member-terminology';

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
}: ConvertLeadButtonProps) {
  const convertLabel = getConvertActionLabel(marketType);
  const noun = getMemberNoun(marketType);
  const nounTitle = noun.replace(/\b\w/g, (c) => c.toUpperCase());
  const futureStart = isFutureDate(effectiveStartDate);
  const [showConfirm, setShowConfirm] = useState(false);
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
      <Button
        onClick={() => setShowConfirm(true)}
        disabled={disabled || isConverting}
        className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white"
      >
        <UserCheck className="w-4 h-4 mr-2" />
        {convertLabel}
      </Button>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
          {!result ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-slate-900 dark:text-white">
                  Convert Lead to {nounTitle}?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-slate-500 space-y-2">
                  <span className="block">
                    This enrolls <strong>{recordTitle}</strong> in the member system as a{' '}
                    <strong>{noun}</strong> and marks this lead as converted.
                  </span>
                  {showContactAlternative && (
                    <span className="block text-amber-700 dark:text-amber-400/90 rounded-md border border-amber-200/80 dark:border-amber-500/30 bg-amber-50/80 dark:bg-amber-950/30 px-2 py-1.5 text-xs">
                      {futureStart ? (
                        <>
                          Coverage starts <strong>{effectiveStartDate}</strong> (still in the future).
                          If they should appear in <strong>Contacts</strong> as{' '}
                          <strong>Pending</strong> until that date, cancel and use{' '}
                          <strong>Convert to Contact</strong> instead.
                        </>
                      ) : (
                        <>
                          To add them to the CRM <strong>Contacts</strong> module only (e.g. Pending
                          until a future plan start), use <strong>Convert to Contact</strong> instead.
                        </>
                      )}
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
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white"
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
