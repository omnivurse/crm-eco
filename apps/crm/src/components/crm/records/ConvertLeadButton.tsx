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

interface ConvertLeadButtonProps {
  recordId: string;
  recordTitle: string;
  disabled?: boolean;
}

export function ConvertLeadButton({ recordId, recordTitle, disabled }: ConvertLeadButtonProps) {
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
          message: 'Lead converted to member successfully!',
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
    } catch (error) {
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
        Convert to Member
      </Button>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
          {!result ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-slate-900 dark:text-white">
                  Convert Lead to Member?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-slate-500">
                  This will create a new member record for <strong>{recordTitle}</strong> in the 
                  enrollment system and mark this lead as converted.
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
