'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@crm-eco/lib/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui';
import { Loader2 } from 'lucide-react';

interface EnrollmentStatusSelectProps {
  enrollmentId: string;
  currentStatus: string;
  organizationId: string;
}

const statuses = [
  { value: 'draft', label: 'Draft' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function EnrollmentStatusSelect({
  enrollmentId,
  currentStatus,
  organizationId,
}: EnrollmentStatusSelectProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === currentStatus) return;

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      // Update enrollment status
      const { error: updateError } = await supabase
        .from('enrollments')
        .update({ status: newStatus })
        .eq('id', enrollmentId);

      if (updateError) throw updateError;

      // Log audit event
      const { error: auditError } = await supabase
        .from('enrollment_audit_log')
        .insert({
          organization_id: organizationId,
          enrollment_id: enrollmentId,
          actor_profile_id: profile.id,
          event_type: 'status_changed',
          old_status: currentStatus,
          new_status: newStatus,
          message: `Status changed from "${currentStatus}" to "${newStatus}"`,
        });

      if (auditError) {
        console.error('Failed to log audit event:', auditError);
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
      console.error('Error updating status:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
      <Select value={currentStatus} onValueChange={handleStatusChange} disabled={loading}>
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {statuses.map((status) => (
            <SelectItem key={status.value} value={status.value}>
              {status.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}

