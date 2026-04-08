'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
import { UserCheck, Loader2, CheckCircle, AlertCircle, ArrowRight, GitMerge } from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';

interface ConvertToContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordId: string;
  recordTitle: string;
  recordData: Record<string, unknown>;
}

export function ConvertToContactDialog({
  open,
  onOpenChange,
  recordId,
  recordTitle,
  recordData,
}: ConvertToContactDialogProps) {
  const [isConverting, setIsConverting] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    contactId?: string;
    contactTitle?: string;
    existingContactId?: string;
  } | null>(null);
  const router = useRouter();

  const handleConvert = async (mergeIntoContactId?: string) => {
    if (mergeIntoContactId) {
      setIsMerging(true);
    } else {
      setIsConverting(true);
    }
    setResult(null);

    try {
      const response = await fetch('/api/crm/leads/convert-to-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId, mergeIntoContactId }),
      });

      const data = await response.json();

      if (data.success) {
        setResult({
          success: true,
          message: data.message || 'Lead converted to contact successfully!',
          contactId: data.contact_id,
          contactTitle: data.contact_title,
        });
        router.refresh();
      } else {
        setResult({
          success: false,
          message: data.error || 'Failed to convert lead to contact',
          existingContactId: data.existing_contact_id,
        });
      }
    } catch {
      setResult({
        success: false,
        message: 'An error occurred during conversion',
      });
    } finally {
      setIsConverting(false);
      setIsMerging(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    onOpenChange(false);
  };

  const email = (recordData?.email as string) || '';
  const company = (recordData?.company as string) || '';

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <AlertDialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
        {!result ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-slate-900 dark:text-white">
                Convert Lead to Contact?
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="text-slate-500 space-y-3">
                  <p>
                    This will create a new <strong className="text-slate-700 dark:text-slate-300">Contact</strong> record
                    from <strong className="text-slate-700 dark:text-slate-300">{recordTitle}</strong> and
                    mark this lead as converted.
                  </p>

                  {/* Field preview */}
                  <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 p-3 text-sm space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Name</span>
                      <span className="text-slate-700 dark:text-slate-300 font-medium">{recordTitle}</span>
                    </div>
                    {email && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Email</span>
                        <span className="text-slate-700 dark:text-slate-300">{email}</span>
                      </div>
                    )}
                    {company && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Company</span>
                        <span className="text-slate-700 dark:text-slate-300">{company}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-white/10">
                      <span className="text-slate-500">Status</span>
                      <span className="flex items-center gap-1.5">
                        <span className="text-slate-400">Lead</span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">Active Contact</span>
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400">
                    All matching fields (name, email, phone, address, family, etc.) will be mapped to the contact record.
                    The original lead will be preserved and linked.
                  </p>
                </div>
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
                onClick={() => handleConvert()}
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
                    Convert to Contact
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
                    <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
                      <AlertCircle className="w-8 h-8 text-amber-500" />
                    </div>
                    <AlertDialogTitle className="text-slate-900 dark:text-white">
                      {result.existingContactId ? 'Existing Contact Found' : 'Conversion Failed'}
                    </AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="text-slate-500 mt-2 space-y-2">
                        <p>{result.message}</p>
                        {result.existingContactId && (
                          <p className="text-sm text-slate-400">
                            You can merge this lead&apos;s data into the existing contact, or view the contact first.
                          </p>
                        )}
                      </div>
                    </AlertDialogDescription>
                  </>
                )}
              </div>
            </AlertDialogHeader>
            <AlertDialogFooter className="justify-center sm:justify-center gap-2">
              {result.success && result.contactId && (
                <Button asChild className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white">
                  <Link href={`/crm/r/${result.contactId}`}>
                    View Contact
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              )}
              {!result.success && result.existingContactId && (
                <>
                  <Button
                    onClick={() => handleConvert(result.existingContactId)}
                    disabled={isMerging}
                    className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-white"
                  >
                    {isMerging ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Merging...</>
                    ) : (
                      <><GitMerge className="w-4 h-4 mr-2" /> Merge into Contact</>
                    )}
                  </Button>
                  <Button asChild variant="outline" className="border-slate-200 dark:border-white/10">
                    <Link href={`/crm/r/${result.existingContactId}`}>
                      View Contact
                    </Link>
                  </Button>
                </>
              )}
              <AlertDialogCancel
                onClick={handleClose}
                className="border-slate-200 dark:border-white/10"
              >
                Close
              </AlertDialogCancel>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
