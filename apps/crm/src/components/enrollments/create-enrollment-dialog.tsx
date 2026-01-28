'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@crm-eco/lib/supabase/client';
import { computeEnrollmentWarnings, getWarningMessages } from '@crm-eco/lib';

// Note: Using type assertion due to @supabase/ssr 0.5.x type inference limitations
function getSupabase(): any {
  return createClient();
}
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui';
import { Plus, Loader2, AlertTriangle } from 'lucide-react';

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  state: string | null;
  date_of_birth: string | null;
}

interface Plan {
  id: string;
  name: string;
  code: string;
}

interface Advisor {
  id: string;
  first_name: string;
  last_name: string;
}

interface CreateEnrollmentDialogProps {
  members: Member[];
  plans: Plan[];
  advisors: Advisor[];
}

export function CreateEnrollmentDialog({ members, plans, advisors }: CreateEnrollmentDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    memberId: '',
    advisorId: '',
    planId: '',
    requestedEffectiveDate: '',
    enrollmentSource: '',
  });

  // Compute warnings when member changes
  useEffect(() => {
    if (formData.memberId) {
      const member = members.find(m => m.id === formData.memberId);
      if (member) {
        const enrollmentWarnings = computeEnrollmentWarnings(member.state, member.date_of_birth);
        const messages = getWarningMessages(enrollmentWarnings);
        setWarnings(messages);
      } else {
        setWarnings([]);
      }
    } else {
      setWarnings([]);
    }
  }, [formData.memberId, members]);

  const resetForm = () => {
    setFormData({
      memberId: '',
      advisorId: '',
      planId: '',
      requestedEffectiveDate: '',
      enrollmentSource: '',
    });
    setError(null);
    setWarnings([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = getSupabase();

      // Get current user's profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      // Get selected member for warnings
      const member = members.find(m => m.id === formData.memberId);
      const enrollmentWarnings = member 
        ? computeEnrollmentWarnings(member.state, member.date_of_birth)
        : { has_mandate_warning: false, has_age65_warning: false };

      // Create enrollment
      const { data: enrollment, error: insertError } = await supabase
        .from('enrollments')
        .insert({
          organization_id: profile.organization_id,
          primary_member_id: formData.memberId,
          advisor_id: formData.advisorId || null,
          selected_plan_id: formData.planId || null,
          requested_effective_date: formData.requestedEffectiveDate || null,
          enrollment_source: formData.enrollmentSource || null,
          status: 'draft',
          has_mandate_warning: enrollmentWarnings.has_mandate_warning,
          has_age65_warning: enrollmentWarnings.has_age65_warning,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      // Create initial enrollment steps
      const steps = ['intake', 'household', 'plan_selection', 'compliance', 'payment', 'confirmation'];
      const stepInserts = steps.map((step, index) => ({
        organization_id: profile.organization_id,
        enrollment_id: enrollment.id,
        step_key: step,
        is_completed: false,
      }));

      await supabase.from('enrollment_steps').insert(stepInserts);

      // Log audit event
      await supabase.from('enrollment_audit_log').insert({
        organization_id: profile.organization_id,
        enrollment_id: enrollment.id,
        actor_profile_id: profile.id,
        event_type: 'created',
        new_status: 'draft',
        message: 'Enrollment created',
      });

      setOpen(false);
      resetForm();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create enrollment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          New Enrollment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Start New Enrollment</DialogTitle>
          <DialogDescription>
            Begin an enrollment journey for a member.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
              {error}
            </div>
          )}
          
          {warnings.length > 0 && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2 text-amber-700 font-medium mb-2">
                <AlertTriangle className="w-4 h-4" />
                Warnings
              </div>
              <ul className="text-sm text-amber-600 space-y-1">
                {warnings.map((warning, idx) => (
                  <li key={idx}>• {warning}</li>
                ))}
              </ul>
            </div>
          )}
          
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="memberId">Primary Member *</Label>
              <Select
                value={formData.memberId}
                onValueChange={(v) => setFormData({ ...formData, memberId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a member" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.first_name} {member.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="advisorId">Advisor (Optional)</Label>
              <Select
                value={formData.advisorId || '__none__'}
                onValueChange={(v) => setFormData({ ...formData, advisorId: v === '__none__' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an advisor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {advisors.map((advisor) => (
                    <SelectItem key={advisor.id} value={advisor.id}>
                      {advisor.first_name} {advisor.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="planId">Plan (Optional)</Label>
              <Select
                value={formData.planId || '__none__'}
                onValueChange={(v) => setFormData({ ...formData, planId: v === '__none__' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Not selected yet</SelectItem>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} ({plan.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="requestedEffectiveDate">Requested Effective Date</Label>
              <Input
                id="requestedEffectiveDate"
                type="date"
                value={formData.requestedEffectiveDate}
                onChange={(e) => setFormData({ ...formData, requestedEffectiveDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="enrollmentSource">Enrollment Source</Label>
              <Select
                value={formData.enrollmentSource}
                onValueChange={(v) => setFormData({ ...formData, enrollmentSource: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="How did they enroll?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="advisor">Advisor</SelectItem>
                  <SelectItem value="web">Website</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.memberId} className="gap-2">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Enrollment'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

