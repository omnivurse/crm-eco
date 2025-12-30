'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Textarea,
  Label,
} from '@crm-eco/ui';
import { MoreHorizontal, Calendar, CheckCircle, FileText, Loader2 } from 'lucide-react';
import { type NeedStatus, getNeedStatusLabel } from '@crm-eco/lib';
import {
  updateNeedStatus,
  updateNeedTargetDate,
  toggleNeedIuaMet,
  addNeedOpsNote,
} from '@/app/(dashboard)/needs/command-center/actions';

interface NeedActionsMenuProps {
  needId: string;
  currentStatus: NeedStatus;
  currentTargetDate: string | null;
  currentIuaMet: boolean;
}

// Status options for the dropdown
const STATUS_OPTIONS: { value: NeedStatus; label: string }[] = [
  { value: 'intake', label: 'Intake' },
  { value: 'awaiting_member_docs', label: 'Waiting on Member Docs' },
  { value: 'awaiting_provider_docs', label: 'Waiting on Provider Docs' },
  { value: 'in_review', label: 'In Review' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'approved', label: 'Approved' },
  { value: 'reimbursement_pending', label: 'Reimbursement Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'closed', label: 'Closed' },
  { value: 'denied', label: 'Denied' },
];

export function NeedActionsMenu({
  needId,
  currentStatus,
  currentTargetDate,
  currentIuaMet,
}: NeedActionsMenuProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  
  // Dialog states
  const [showDateDialog, setShowDateDialog] = useState(false);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [targetDate, setTargetDate] = useState(currentTargetDate || '');
  const [noteText, setNoteText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleStatusChange = async (newStatus: NeedStatus) => {
    if (newStatus === currentStatus) return;
    
    startTransition(async () => {
      const result = await updateNeedStatus(needId, newStatus);
      if (!result.success) {
        setError(result.error || 'Failed to update status');
      } else {
        router.refresh();
      }
    });
  };

  const handleDateSubmit = async () => {
    if (!targetDate) return;
    
    startTransition(async () => {
      const result = await updateNeedTargetDate(needId, targetDate);
      if (!result.success) {
        setError(result.error || 'Failed to update target date');
      } else {
        setShowDateDialog(false);
        router.refresh();
      }
    });
  };

  const handleToggleIua = async () => {
    startTransition(async () => {
      const result = await toggleNeedIuaMet(needId, !currentIuaMet);
      if (!result.success) {
        setError(result.error || 'Failed to update IUA status');
      } else {
        router.refresh();
      }
    });
  };

  const handleNoteSubmit = async () => {
    if (!noteText.trim()) return;
    
    startTransition(async () => {
      const result = await addNeedOpsNote(needId, noteText);
      if (!result.success) {
        setError(result.error || 'Failed to add note');
      } else {
        setNoteText('');
        setShowNoteDialog(false);
        router.refresh();
      }
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" disabled={isPending}>
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <MoreHorizontal className="w-4 h-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Change Status</DropdownMenuLabel>
          {STATUS_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handleStatusChange(option.value)}
              disabled={option.value === currentStatus}
              className={option.value === currentStatus ? 'bg-slate-100' : ''}
            >
              {option.value === currentStatus && (
                <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
              )}
              {option.label}
            </DropdownMenuItem>
          ))}
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={() => setShowDateDialog(true)}>
            <Calendar className="w-4 h-4 mr-2" />
            Set Target Date...
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={handleToggleIua}>
            <CheckCircle className="w-4 h-4 mr-2" />
            {currentIuaMet ? 'Mark IUA as Not Met' : 'Mark IUA as Met'}
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={() => setShowNoteDialog(true)}>
            <FileText className="w-4 h-4 mr-2" />
            Add Ops Note...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Target Date Dialog */}
      <Dialog open={showDateDialog} onOpenChange={setShowDateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Target Completion Date</DialogTitle>
            <DialogDescription>
              Set the target date by which this Need should be resolved.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="target-date">Target Date</Label>
            <Input
              id="target-date"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="mt-2"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleDateSubmit} disabled={isPending || !targetDate}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ops Note Dialog */}
      <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Ops Note</DialogTitle>
            <DialogDescription>
              Add an internal note to this Need. This will be visible in the activity timeline.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="ops-note">Note</Label>
            <Textarea
              id="ops-note"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Enter your note..."
              rows={4}
              className="mt-2"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNoteDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleNoteSubmit} disabled={isPending || !noteText.trim()}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Add Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

