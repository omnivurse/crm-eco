'use client';

import { useMemo, useState } from 'react';
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
import { resolveEffectiveStartDate } from '@/lib/crm/resolve-effective-start-date';
import {
  getConvertedContactId,
  isLeadRecordConverted,
} from '@/lib/crm/lead-conversion-result';
import { getEnrollActionLabel } from '@/lib/crm/member-terminology';

interface ConvertToContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordId: string;
  recordTitle: string;
  recordData: Record<string, unknown>;
  marketType?: string | null;
}

export function ConvertToContactDialog({
  open,
  onOpenChange,
  recordId,
  recordTitle,
  recordData,
  marketType,
}: ConvertToContactDialogProps) {
  // "Enroll as Member" / "Enroll as Insurance Client" — the same wording as
  // the shell's Convert… menu, so the hint names the action the rep will see.
  const enrollActionLabel = getEnrollActionLabel(marketType);
  const [isConverting, setIsConverting] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    contactId?: string;
    contactTitle?: string;
    existingContactId?: string;
    alreadyConverted?: boolean;
    insuranceRepairWarning?: string;
  } | null>(null);
  const router = useRouter();

  const linkedContactId = getConvertedContactId(recordData);
  const leadAlreadyConverted = isLeadRecordConverted({ data: recordData });

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

      if (!response.ok) {
        const contactHint =
          data?.existing_contact_id ?? data?.converted_contact_id ?? data?.contact_id;
        setResult({
          success: false,
          message:
            typeof data?.error === 'string'
              ? data.error
              : response.status === 403
                ? 'You do not have permission to convert leads. Ask a manager or admin if this is unexpected.'
                : 'Failed to convert lead to contact',
          existingContactId: contactHint,
        });
        return;
      }

      if (data.success) {
        const repairWarning =
          data.insurance_repair_failed
            ? 'Contact created, but some coverage fields may need a manual review in Health Share / Health Insurance.'
            : undefined;
        setResult({
          success: true,
          message:
            data.message ||
            (data.already_converted
              ? 'This lead is already linked to a contact.'
              : 'Lead converted to contact successfully!'),
          contactId: data.contact_id,
          contactTitle: data.contact_title,
          alreadyConverted: data.already_converted === true,
          insuranceRepairWarning: repairWarning,
        });
        router.refresh();
      } else {
        const contactHint =
          data.existing_contact_id ?? data.converted_contact_id ?? data.contact_id;
        setResult({
          success: false,
          message: data.error || 'Failed to convert lead to contact',
          existingContactId: contactHint,
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
  const effectiveStartDate = useMemo(
    () => resolveEffectiveStartDate({ data: recordData }),
    [recordData],
  );
  const today = new Date().toISOString().slice(0, 10);
  const willBePending =
    effectiveStartDate != null && effectiveStartDate > today;
  const targetStatusLabel = willBePending ? 'Pending Contact' : 'Active Contact';
  const targetStatusClass = willBePending
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-emerald-600 dark:text-emerald-400';

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <AlertDialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
        {!result ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-slate-900 dark:text-white">
                {leadAlreadyConverted ? 'Lead Already Converted' : 'Convert Lead to Contact?'}
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="text-slate-500 space-y-3">
                  {leadAlreadyConverted && linkedContactId ? (
                    <>
                      <p>
                        <strong className="text-slate-700 dark:text-slate-300">{recordTitle}</strong>{' '}
                        is already linked to a contact. Open the contact record to continue working the
                        account — you do not need to convert again.
                      </p>
                    </>
                  ) : (
                  <>
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
                    {effectiveStartDate && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Start Date</span>
                        <span className="text-slate-700 dark:text-slate-300">{effectiveStartDate}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-white/10">
                      <span className="text-slate-500">Status</span>
                      <span className="flex items-center gap-1.5">
                        <span className="text-slate-400">Lead</span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <span className={`${targetStatusClass} font-medium`}>{targetStatusLabel}</span>
                      </span>
                    </div>
                  </div>

                  {willBePending && (
                    <p className="text-xs text-amber-600 dark:text-amber-400/90">
                      Coverage starts in the future — the new contact will stay Pending until{' '}
                      {effectiveStartDate}, then auto-activate daily.
                    </p>
                  )}

                  <p className="text-xs text-slate-400">
                    All matching fields (name, email, phone, address, family, Health Share,
                    Health Insurance, etc.) and all notes will be moved to the contact record.
                    The original lead will be preserved and linked.
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400/90">
                    Creates a CRM contact only — it does not enroll them in the member system
                    ({enrollActionLabel} does that).
                  </p>
                  </>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              {leadAlreadyConverted && linkedContactId ? (
                <>
                  <Button asChild className="bg-brand-accent text-white hover:opacity-95">
                    <Link href={`/crm/r/${linkedContactId}`}>
                      View Contact
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                  <AlertDialogCancel
                    onClick={handleClose}
                    className="border-slate-200 dark:border-white/10"
                  >
                    Close
                  </AlertDialogCancel>
                </>
              ) : (
              <>
              <AlertDialogCancel
                disabled={isConverting}
                className="border-slate-200 dark:border-white/10"
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={isConverting}
                onClick={(event) => {
                  // AlertDialog.Action closes immediately by default; with controlled `open`,
                  // that wipes the modal before conversion finishes (user sees nothing / no toast).
                  event.preventDefault();
                  void handleConvert();
                }}
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
                    Convert to Contact
                  </>
                )}
              </AlertDialogAction>
              </>
              )}
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
                    {result.insuranceRepairWarning && (
                      <p className="text-xs text-amber-600 dark:text-amber-400/90 mt-3 rounded-md border border-amber-200/80 dark:border-amber-500/30 bg-amber-50/80 dark:bg-amber-950/30 px-2 py-1.5">
                        {result.insuranceRepairWarning}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
                      <AlertCircle className="w-8 h-8 text-amber-500" />
                    </div>
                    <AlertDialogTitle className="text-slate-900 dark:text-white">
                      {result.existingContactId
                        ? 'Existing Contact Found'
                        : result.alreadyConverted
                          ? 'Already Linked to Contact'
                          : 'Conversion Failed'}
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
                <Button asChild className="bg-brand-accent text-white hover:opacity-95">
                  <Link href={`/crm/r/${result.contactId}`}>
                    {result.alreadyConverted ? 'Open Contact' : 'View Contact'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              )}
              {!result.success && result.existingContactId && (
                <>
                  <Button
                    onClick={() => handleConvert(result.existingContactId)}
                    disabled={isMerging}
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
