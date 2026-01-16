'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@crm-eco/ui';
import { MoreVertical, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';

interface EnrollmentActionsProps {
  enrollmentId: string;
  currentStatus: string;
}

export function EnrollmentActions({ enrollmentId, currentStatus }: EnrollmentActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const updateStatus = async (newStatus: string) => {
    setLoading(true);

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error } = await supabase
      .from('enrollments')
      .update({ status: newStatus })
      .eq('id', enrollmentId);

    if (error) {
      console.error('Failed to update status:', error);
      setLoading(false);
      return;
    }

    // Log the status change
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, organization_id')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        await supabase.from('enrollment_audit_log').insert({
          enrollment_id: enrollmentId,
          organization_id: profile.organization_id,
          actor_profile_id: profile.id,
          event_type: 'status_change',
          old_status: currentStatus,
          new_status: newStatus,
          message: `Status changed from ${currentStatus} to ${newStatus}`,
        });
      }
    }

    setLoading(false);
    router.refresh();
  };

  const canApprove = ['submitted', 'in_progress'].includes(currentStatus);
  const canReject = ['submitted', 'in_progress'].includes(currentStatus);
  const canCancel = !['cancelled', 'rejected'].includes(currentStatus);
  const canReopen = ['rejected', 'cancelled'].includes(currentStatus);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MoreVertical className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canApprove && (
          <DropdownMenuItem
            onClick={() => updateStatus('approved')}
            className="text-green-600"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Approve Enrollment
          </DropdownMenuItem>
        )}
        {canReject && (
          <DropdownMenuItem
            onClick={() => updateStatus('rejected')}
            className="text-red-600"
          >
            <XCircle className="h-4 w-4 mr-2" />
            Reject Enrollment
          </DropdownMenuItem>
        )}
        {canReopen && (
          <DropdownMenuItem onClick={() => updateStatus('in_progress')}>
            <Clock className="h-4 w-4 mr-2" />
            Reopen as In Progress
          </DropdownMenuItem>
        )}
        {(canApprove || canReject || canReopen) && canCancel && <DropdownMenuSeparator />}
        {canCancel && (
          <DropdownMenuItem
            onClick={() => updateStatus('cancelled')}
            className="text-red-600"
          >
            <XCircle className="h-4 w-4 mr-2" />
            Cancel Enrollment
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
